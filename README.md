# GezinsHub (Life360-achtige familie app)

Een eenvoudige webapp voor gezinnen met:

- Familie check-ins
- Agenda met activiteiten
- Poll voor avondeten (3 opties)
- Poll voor avondprogramma (3 opties)
- Boodschappenlijst
- Weer op thuislocatie (ochtend/middag/avond + buienkans)
- Takenlijst met top 3 prioriteiten
- Foto collage upload
- Noodcontacten
- Gezamenlijke notities

## Starten

### Optie 1 (snelste): direct bestand openen

Open `index.html` in je browser.

### Optie 2 (aanbevolen): lokale webserver starten

Gebruik vanuit de projectmap:

```bash
python3 -m http.server 8000 --directory /workspace/maastricht-tour-app
```

Open daarna in dezelfde omgeving:

- `http://127.0.0.1:8000`
- of `http://localhost:8000`

## Probleemoplossing: "ik kan de app niet openen"

Als je in een **remote omgeving** werkt (bijv. cloud/VM/Container), dan werkt `127.0.0.1` vaak alleen **binnen** die omgeving.

Gebruik dan één van deze stappen:

1. Forward poort `8000` in je editor/platform (bijv. VS Code "Ports" tab).
2. Open daarna de gegenereerde publieke/forwarded URL in je eigen browser.
3. Controleer of de server nog draait.

Handige checks:

```bash
# Controleer dat de server luistert
curl -I http://127.0.0.1:8000

# Zie welk proces poort 8000 gebruikt
lsof -i :8000
```

Als poort 8000 al in gebruik is, start op een andere poort:

```bash
python3 -m http.server 8080 --directory /workspace/maastricht-tour-app
```

en open `http://127.0.0.1:8080` (of de forwarded URL voor poort 8080).
