# API des Horaires de Bus

API permettant de récupérer les horaires de bus (FlixBus et BlaBlaBus) pour la gare routière de Montpellier Sabines.

## Fonctionnalités

- Récupération des horaires FlixBus
- Récupération des horaires BlaBlaBus
- Protection contre les abus (rate limiting)
- Vérification de l'état du serveur

## Installation

```bash
# Installer les dépendances
npm install

# Créer un fichier .env à la racine avec les variables suivantes
FLIXBUS_API_KEY=votre_clé_api
FLIXBUS_STATION_ID=votre_station_id
BLABLABUS_URL=url_du_fichier_zip
BLABLABUS_STATION_ID=votre_station_id
PORT=5000
```

## Démarrage

```bash
# Mode développement (avec redémarrage automatique)
npm run dev

# Mode production
npm start
```

## Structure du projet

```
├── server.js              # Point d'entrée
├── routes/                # Définition des routes
├── controllers/           # Logique métier
├── middleware/            # Middleware (rate limiting)
├── utils/                 # Fonctions utilitaires
└── config/                # Configuration
```

## Routes API

### FlixBus
```
GET /api/bus-departures-flixbus?from=2023-04-12&to=2023-04-13
```

### BlaBlaBus
```
GET /api/bus-departures-blablabus?from=2023-04-12&to=2023-04-13
```

### Vérification du serveur
```
GET /api/health
```

## Protection contre les abus

L'API est protégée contre les abus avec les limites suivantes :
- 100 requêtes par IP toutes les 15 minutes pour les routes des bus
- 50 requêtes par IP toutes les 5 minutes pour la route de santé

## Paramètres de requête

- `from` : Date de début (format ISO, ex: 2023-04-12T00:00:00Z)
- `to` : Date de fin (format ISO, ex: 2023-04-13T00:00:00Z)
- `tzOffset` : Décalage de fuseau horaire (optionnel)

## Format de réponse

```json
{
  "rides": [
    {
      "id": "bus-123",
      "status": {
        "scheduled_timestamp": "2023-04-12T14:30:00+02:00",
        "deviation": {
          "deviation_seconds": 0,
          "deviation_class": "ON_TIME"
        }
      },
      "line": {
        "code": "123",
        "brand": {
          "name": "FlixBus"
        }
      },
      "calls": [...]
    }
  ],
  "station": {
    "name": "Montpellier - Sabines Bus Station"
  }
}
```