# Landmark Weather

A local browser app that shows current weather as a 3D animated scene over a landmark photo background.

Published page:

`https://pauldongin.github.io/weather-landmark-visualizer/`

## Run

```powershell
npm install
npm start
```

Open `http://127.0.0.1:5173`.

## Visual Check

```powershell
npm run test:visual
```

## Data Sources

- Weather: Open-Meteo Forecast API
- City search: Open-Meteo Geocoding API
- Current-location place label: Nominatim/OpenStreetMap
- Famous landmark photos: Wikipedia page image API resolved through Wikimedia Commons metadata
- Search fallback photos and attribution: Wikimedia Commons API

The app asks for browser location permission. If location is blocked, use search or the landmark chips.
