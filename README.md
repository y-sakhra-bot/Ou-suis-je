# Où suis-je – application GPS

Application web mobile (PWA) qui lit les coordonnées GPS du téléphone et les affiche sur une carte.

## Fonctions
- Lecture de la position GPS (latitude, longitude, précision, altitude, vitesse)
- Affichage sur carte OpenStreetMap (plan ou satellite), cercle de précision
- Suivi continu de la position
- Ouverture en un clic dans **Google Maps**, OpenStreetMap ou Waze
- Copie / partage des coordonnées (format décimal et degrés-minutes-secondes)
- Levé de points : numérotation automatique, code/description, mesure moyennée sur 5, 10 ou 30 s
- Export pour **QGIS** (GeoJSON, WGS84 / EPSG:4326), **Google Earth** (KML) et tableur (CSV)
- Option de relier les points en ligne ou en polygone, dans l'ordre des numéros
- Installable sur l'écran d'accueil (Android et iPhone)

## Mettre en ligne (obligatoire : HTTPS)
Les navigateurs n'autorisent le GPS que sur une adresse `https://`. Le plus simple :

1. **Netlify Drop** : aller sur https://app.netlify.com/drop et glisser le dossier `app-geolocalisation`. Une adresse https est donnée tout de suite.
2. Ou **GitHub Pages** : mettre les fichiers dans un dépôt GitHub, puis Settings → Pages.

Ouvrir ensuite l'adresse sur le téléphone, appuyer sur « Me localiser » et accepter la demande de localisation.
Pour l'installer : menu du navigateur → « Ajouter à l'écran d'accueil ».

## Fichiers
- `index.html` : l'application (carte Leaflet + API Geolocation)
- `manifest.webmanifest`, `icon.svg`, `sw.js` : installation en PWA

## Levé et export
1. Saisir un code (facultatif), laisser « Moyenner » coché, appuyer sur « Relever le point » et rester immobile pendant la mesure.
2. Dans « Points enregistrés », choisir la géométrie (points, ligne ou polygone), puis exporter.
3. **QGIS** : glisser le fichier `.geojson` dans QGIS (WGS84). Pour des mesures en mètres, l'enregistrer dans la projection locale (par ex. Lambert) avec Exporter → Sauvegarder les entités sous.
4. **Google Earth** : ouvrir le fichier `.kml` (Fichier → Ouvrir).

Attributs de chaque point : num, code, latitude, longitude, altitude_m, precision_m, nb_mesures, date.

**Précision** : le GPS d'un téléphone donne en général 3 à 10 m. Cela convient pour un repérage ou un levé sommaire, pas pour un levé topographique de précision, qui demande un GNSS RTK.

## Traceurs GPS externes (plusieurs à la fois)
L'app affiche en direct plusieurs traceurs à travers un serveur **Traccar** (gratuit, open source). Traccar comprend plus de 200 protocoles : Teltonika, Concox/GT06, Sinotrack, Coban, Queclink, Meitrack, montres GPS, etc.

1. **Serveur** : pour essayer, utilisez un serveur de démonstration (https://demo.traccar.org, créez un compte). Pour un usage réel, installez Traccar sur un petit serveur (VPS) avec une adresse https, ou prenez l'offre hébergée de traccar.org.
2. **Traceur** : configurez-le (souvent par SMS, voir sa notice) pour qu'il envoie à l'adresse du serveur, sur le port de son protocole. L'app affiche ce port quand vous choisissez le modèle. Liste complète : https://www.traccar.org/devices/
3. **App** : ouvrez « Traceurs GPS », entrez l'adresse du serveur et vos identifiants Traccar, puis ajoutez chaque traceur (nom + IMEI).

Ce que l'app permet : position en direct de tous les traceurs (rafraîchie toutes les 10 s), statut en ligne/hors ligne, vitesse, suivi d'un traceur, historique sur 1 h à 7 jours et export GPX / GeoJSON / KML.

Si la connexion échoue avec « Serveur injoignable », ajoutez dans `traccar.xml` du serveur :
`<entry key='web.origin'>https://y-sakhra-bot.github.io</entry>` puis redémarrez Traccar.
