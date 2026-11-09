// Suivi de traceurs GPS externes via un serveur Traccar (https://www.traccar.org).
// Traccar reçoit les trames de plus de 200 protocoles (Teltonika, Concox/GT06, Coban, Sinotrack, Queclink…)
// et les expose par une API REST que cette page interroge.
(function () {
  const app = window.__app; if (!app) return;
  const { map, saveFile, toast } = app;
  const $ = (id) => document.getElementById(id);
  const CKEY = 'geoapp.traccar';
  const COLORS = ['#e6194b', '#3cb44b', '#4363d8', '#f58231', '#911eb4', '#008080', '#9a6324', '#800000', '#000075', '#f032e6'];

  // Modèles courants → protocole Traccar et port d'écoute par défaut (liste complète : traccar.org/devices)
  const MODELS = [
    ['Teltonika (FMB, FMC, FMT…)', 'teltonika', 5027],
    ['Concox / Jimi (GT06, JM-VL, AT4…)', 'gt06', 5023],
    ['Sinotrack (ST-901, ST-903…)', 'h02', 5013],
    ['Protocole H02 (nombreux clones chinois)', 'h02', 5013],
    ['Coban (TK103, GPS103…)', 'gps103', 5001],
    ['TK103 (Xexun et compatibles)', 'tk103', 5002],
    ['Queclink (GV, GL…)', 'gl200', 5004],
    ['Meitrack', 'meitrack', 5020],
    ['Suntech', 'suntech', 5011],
    ['Montres GPS enfants / seniors (protocole watch)', 'watch', 5093],
    ['Téléphone avec Traccar Client (Android / iPhone)', 'osmand', 5055],
    ['Autre modèle (voir traccar.org/devices)', '', null]
  ];

  let cfg = (() => { try { return JSON.parse(localStorage.getItem(CKEY)) || {}; } catch { return {}; } })();
  let devices = [], positions = {}, timer = null, layer = L.layerGroup().addTo(map), histLayer = L.layerGroup().addTo(map);
  let follow = null, lastHist = null;

  // ---------- API ----------
  function authHeader() {
    if (cfg.token) return 'Bearer ' + cfg.token;
    return 'Basic ' + btoa(unescape(encodeURIComponent(`${cfg.email}:${cfg.password}`)));
  }
  async function api(path, opts = {}) {
    const url = cfg.url.replace(/\/+$/, '') + '/api' + path;
    const r = await fetch(url, { ...opts, headers: { Authorization: authHeader(), Accept: 'application/json',
      ...(opts.body ? { 'Content-Type': 'application/json' } : {}) } });
    if (r.status === 401) throw new Error('Identifiants refusés par le serveur (401).');
    if (!r.ok) throw new Error(`Erreur serveur ${r.status} : ${(await r.text()).slice(0, 160)}`);
    return r.status === 204 ? null : r.json();
  }

  // ---------- Connexion ----------
  function fillForm() {
    $('tcUrl').value = cfg.url || ''; $('tcEmail').value = cfg.email || '';
    $('tcPass').value = cfg.password || ''; $('tcToken').value = cfg.token || '';
    $('tcModel').innerHTML = MODELS.map((m, i) => `<option value="${i}">${m[0]}</option>`).join('');
    showModelHelp();
  }
  async function connect() {
    cfg = { url: $('tcUrl').value.trim(), email: $('tcEmail').value.trim(), password: $('tcPass').value, token: $('tcToken').value.trim() };
    if (!/^https:\/\//i.test(cfg.url)) return setState("L'adresse du serveur doit commencer par https://", true);
    if (!cfg.token && !(cfg.email && cfg.password)) return setState('Indiquez un e-mail et un mot de passe, ou un jeton.', true);
    setState('Connexion…');
    try {
      await api('/devices');
      try { localStorage.setItem(CKEY, JSON.stringify(cfg)); } catch {}
      $('tcForm').hidden = true; $('tcLive').hidden = false;
      await refresh(true); clearInterval(timer); timer = setInterval(refresh, 10000);
    } catch (e) {
      setState(e instanceof TypeError
        ? "Serveur injoignable. Vérifiez l'adresse, et que le serveur accepte les requêtes de ce site (CORS, voir le mode d'emploi)."
        : e.message, true);
    }
  }
  function disconnect() {
    clearInterval(timer); timer = null; layer.clearLayers(); histLayer.clearLayers(); devices = []; positions = {};
    cfg = {}; try { localStorage.removeItem(CKEY); } catch {}
    $('tcLive').hidden = true; $('tcForm').hidden = false; fillForm(); setState('Déconnecté.');
  }
  function setState(msg, err) { const s = $('tcState'); s.textContent = msg; s.className = err ? 'err' : 'dms'; }

  // ---------- Affichage en direct ----------
  async function refresh(fit) {
    try {
      const [devs, poss] = await Promise.all([api('/devices'), api('/positions')]);
      devices = devs.sort((a, b) => a.name.localeCompare(b.name));
      positions = {}; poss.forEach(p => (positions[p.deviceId] = p));
      render(fit);
      setState(`Mis à jour à ${new Date().toLocaleTimeString('fr-FR')} · ${devices.length} traceur(s)`);
    } catch (e) { setState(e.message || 'Connexion perdue, nouvel essai dans 10 s.', true); }
  }
  const color = (d) => COLORS[devices.indexOf(d) % COLORS.length];
  function ago(t) {
    if (!t) return 'jamais'; const s = (Date.now() - new Date(t)) / 1000;
    return s < 90 ? "à l'instant" : s < 3600 ? `il y a ${Math.round(s / 60)} min` : s < 86400 ? `il y a ${Math.round(s / 3600)} h` : new Date(t).toLocaleDateString('fr-FR');
  }
  function render(fit) {
    layer.clearLayers(); const ul = $('tcList'); ul.innerHTML = ''; const bounds = [];
    devices.forEach(d => {
      const p = positions[d.id], c = color(d);
      const li = document.createElement('li');
      const dot = document.createElement('i'); dot.className = 'dot'; dot.style.background = c;
      const txt = document.createElement('span');
      const kmh = p ? Math.round((p.speed || 0) * 1.852) : null; // Traccar donne la vitesse en nœuds
      txt.textContent = `${d.name} · ${d.status === 'online' ? 'en ligne' : d.status === 'offline' ? 'hors ligne' : 'inconnu'}`
        + (p ? ` · ${kmh} km/h · ${ago(p.fixTime)}` : ' · aucune position');
      const go = document.createElement('button'); go.textContent = follow === d.id ? 'Suivi ✓' : 'Suivre';
      go.disabled = !p; go.onclick = () => { follow = follow === d.id ? null : d.id; render(); if (p) map.setView([p.latitude, p.longitude], 16); };
      const h = document.createElement('button'); h.textContent = 'Historique';
      h.onclick = () => history(d);
      li.append(dot, txt, go, h); ul.append(li);
      if (p) {
        const ll = [p.latitude, p.longitude]; bounds.push(ll);
        L.circleMarker(ll, { radius: 9, color: '#fff', weight: 2, fillColor: c, fillOpacity: 1 })
          .bindTooltip(d.name, { permanent: true, direction: 'top', offset: [0, -8] })
          .bindPopup(`<b>${esc(d.name)}</b><br>${p.latitude.toFixed(6)}, ${p.longitude.toFixed(6)}<br>${kmh} km/h · ${new Date(p.fixTime).toLocaleString('fr-FR')}`
            + `<br><a target="_blank" rel="noopener" href="https://www.google.com/maps/search/?api=1&query=${p.latitude},${p.longitude}">Ouvrir dans Google Maps</a>`)
          .addTo(layer);
        if (follow === d.id) map.panTo(ll);
      }
    });
    if (!devices.length) ul.innerHTML = '<li class="dms">Aucun traceur sur ce serveur. Ajoutez-en un ci-dessous.</li>';
    if (fit && bounds.length) map.fitBounds(bounds, { padding: [40, 40], maxZoom: 16 });
  }
  const esc = (s) => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);

  // ---------- Historique ----------
  async function history(d) {
    const hours = +$('tcHours').value, to = new Date(), from = new Date(to - hours * 3600e3);
    try {
      const pts = await api(`/positions?deviceId=${d.id}&from=${from.toISOString()}&to=${to.toISOString()}`);
      histLayer.clearLayers();
      if (pts.length < 2) { lastHist = null; $('tcHistBox').hidden = true; return toast(`Pas de trajet pour ${d.name} sur ${hours} h`); }
      const line = L.polyline(pts.map(p => [p.latitude, p.longitude]), { color: color(d), weight: 4, opacity: .8 }).addTo(histLayer);
      map.fitBounds(line.getBounds(), { padding: [30, 30] });
      let dist = 0; for (let i = 1; i < pts.length; i++) dist += map.distance([pts[i - 1].latitude, pts[i - 1].longitude], [pts[i].latitude, pts[i].longitude]);
      lastHist = { d, pts, dist };
      $('tcHistTxt').textContent = `${d.name} : ${pts.length} positions, ${(dist / 1000).toFixed(2)} km sur ${hours} h`;
      $('tcHistBox').hidden = false;
    } catch (e) { toast(e.message); }
  }
  function histGpx() {
    const { d, pts } = lastHist;
    return `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="Ou suis-je" xmlns="http://www.topografix.com/GPX/1/1">
 <trk><name>${esc(d.name)}</name><trkseg>
${pts.map(p => `  <trkpt lat="${p.latitude}" lon="${p.longitude}"><ele>${p.altitude || 0}</ele><time>${new Date(p.fixTime).toISOString()}</time></trkpt>`).join('\n')}
 </trkseg></trk>
</gpx>`;
  }
  function histGeojson() {
    const { d, pts, dist } = lastHist;
    return JSON.stringify({ type: 'FeatureCollection', name: d.name, features: [{ type: 'Feature',
      properties: { traceur: d.name, imei: d.uniqueId, debut: pts[0].fixTime, fin: pts.at(-1).fixTime, distance_m: Math.round(dist), nb_points: pts.length },
      geometry: { type: 'LineString', coordinates: pts.map(p => [p.longitude, p.latitude]) } }] });
  }
  function histKml() {
    const { d, pts } = lastHist;
    return `<?xml version="1.0" encoding="UTF-8"?>
<kml xmlns="http://www.opengis.net/kml/2.2"><Document><name>${esc(d.name)}</name>
 <Placemark><name>${esc(d.name)}</name><Style><LineStyle><color>ff0000ff</color><width>4</width></LineStyle></Style>
 <LineString><tessellate>1</tessellate><coordinates>${pts.map(p => `${p.longitude},${p.latitude},0`).join(' ')}</coordinates></LineString></Placemark>
</Document></kml>`;
  }
  const fname = (ext) => `${lastHist.d.name.replace(/[^\w-]+/g, '_')}_${new Date().toISOString().slice(0, 10)}.${ext}`;

  // ---------- Ajout d'un traceur selon le modèle ----------
  function showModelHelp() {
    const m = MODELS[+$('tcModel').value || 0]; let host = '';
    try { host = new URL(cfg.url || $('tcUrl').value).hostname; } catch {}
    $('tcModelHelp').textContent = m[2]
      ? `À configurer dans le traceur (souvent par SMS, voir sa notice) : serveur ${host || 'adresse-de-votre-serveur'}, port ${m[2]}. L'identifiant est en général l'IMEI.`
      : "Cherchez votre modèle sur traccar.org/devices : la page indique le protocole et le port à configurer.";
  }
  async function addDevice() {
    const name = $('tcName').value.trim(), uniqueId = $('tcImei').value.trim(), m = MODELS[+$('tcModel').value];
    if (!name || !uniqueId) return toast("Indiquez un nom et l'identifiant (IMEI)");
    try {
      await api('/devices', { method: 'POST', body: JSON.stringify({ name, uniqueId, model: m[1] ? m[0] : '' }) });
      $('tcName').value = ''; $('tcImei').value = ''; toast(`${name} ajouté`); refresh(true);
    } catch (e) { toast(e.message); }
  }

  // ---------- Branchements ----------
  $('tcConnect').onclick = connect;
  $('tcLogout').onclick = disconnect;
  $('tcFit').onclick = () => { follow = null; render(true); };
  $('tcModel').onchange = showModelHelp;
  $('tcUrl').oninput = showModelHelp;
  $('tcAdd').onclick = addDevice;
  $('tcHistClear').onclick = () => { histLayer.clearLayers(); lastHist = null; $('tcHistBox').hidden = true; };
  $('tcGpx').onclick = () => lastHist && saveFile(histGpx(), fname('gpx'), 'application/gpx+xml');
  $('tcGeo').onclick = () => lastHist && saveFile(histGeojson(), fname('geojson'), 'application/geo+json');
  $('tcKml').onclick = () => lastHist && saveFile(histKml(), fname('kml'), 'application/vnd.google-earth.kml+xml');
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible' && timer) refresh(); });

  fillForm();
  if (cfg.url) connect();
})();
