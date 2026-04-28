# Port Manager

Ein minimaler lokaler Web-Dashboard zum Überwachen und Verwalten aktiver TCP-Ports auf Windows.

## Start

```bash
node pm.js
```

Danach im Browser öffnen: [http://localhost:3099](http://localhost:3099)

## Features

- **Ports anzeigen** – listet alle lauschenden TCP-Ports mit PID und Prozessname
- **Kill** – beendet einen Prozess per PID (Stop-Process -Force)
- **Restart** – killt den Prozess auf dem Port und startet automatisch `server.js` / `index.js` / `app.js` neu (sucht im selben Verzeichnis)
- **Öffnen** – öffnet `http://localhost:<port>` direkt im Browser
- **Auto-Refresh** – aktualisiert die Liste alle 8 Sekunden automatisch

## Voraussetzungen

- Windows (nutzt PowerShell `Get-NetTCPConnection`)
- Node.js (kein npm install nötig – nur Standardmodule)

## Port

Der Manager läuft selbst auf Port `3099` (änderbar über `PM_PORT` in `pm.js`).
