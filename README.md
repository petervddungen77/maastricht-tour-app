# FamilieKring

Een familie-locatie-app in de stijl van Life360, volledig client-side gebouwd
met HTML, CSS en JavaScript (Leaflet + OpenStreetMap). Geen build-stap of
backend nodig.

## Functies

- **Live kaart** — alle leden van je cirkel zichtbaar op een kaart van Maastricht,
  met gesimuleerde live bewegingen.
- **Cirkels** — wissel tussen groepen (Familie, Vrienden) via de keuzelijst bovenaan.
- **Ledenoverzicht** — per lid: huidige plaats, batterijpercentage en snelheid.
  Klik op een lid om naar diens locatie te vliegen en de route (trail) te zien.
- **Plaatsen (geofences)** — standaard Thuis, School en Werk. Voeg zelf plaatsen
  toe door op de kaart te klikken; je krijgt een melding wanneer iemand aankomt
  of vertrekt. Plaatsen worden bewaard in localStorage.
- **Chat** — stuur berichten naar je cirkel (met gesimuleerde antwoorden);
  berichten worden per cirkel bewaard in localStorage.
- **Rijrapporten** — per lid een rapport (📊-knop) met afgelegde afstand,
  topsnelheid, hard remmen en een rijscore.
- **Meldingen** — feed met aankomst-/vertrekmeldingen, check-ins, bijna lege
  batterij en SOS.
- **Inchecken** — deel met één klik waar je bent.
- **SOS** — noodknop met aftelling; je marker gaat pulseren en de cirkel krijgt
  een noodmelding.
- **Echte locatie** — knop "📍 Mijn locatie" gebruikt de geolocatie van je
  browser voor je eigen positie.

## Starten

Open `index.html` in een browser, of serveer de map lokaal:

```bash
python3 -m http.server 8000
# open http://localhost:8000
```

> Voor de knop "Mijn locatie" is HTTPS of localhost vereist (browservereiste
> voor geolocatie).
