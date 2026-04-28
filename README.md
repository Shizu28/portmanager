# Port Manager

Ein minimaler lokaler Dashboard zum Überwachen und Verwalten aktiver TCP-Ports auf Windows — als native Desktop-App.

## Download

Einfach `dist\Port Manager 1.0.0.exe` herunterladen und starten — kein Node.js, kein Install nötig.

## Selbst bauen

```bash
npm install
npm run build
```

Die fertige `.exe` landet in `dist/`.

> Beim ersten Build wird `$env:CSC_IDENTITY_AUTO_DISCOVERY='false'` benötigt um Code-Signing zu überspringen:
> ```powershell
> $env:CSC_IDENTITY_AUTO_DISCOVERY='false'; npm run build
> ```

## Entwicklung (ohne Build)

```bash
npm install
npm start
```

Oder nur den HTTP-Server starten:
```bash
node pm.js
# → http://localhost:3099
```

## Features

- **Ports anzeigen** – listet alle lauschenden TCP-Ports mit PID und Prozessname
- **Kill** – beendet einen Prozess per PID
- **Restart** – killt den Prozess und startet `server.js` / `index.js` / `app.js` neu
- **Öffnen** – öffnet `http://localhost:<port>` im Browser
- **Auto-Refresh** – aktualisiert die Liste alle 8 Sekunden
- **Tray-Icon** – läuft im Hintergrund, Klick öffnet das Fenster

## Voraussetzungen

- Windows (nutzt PowerShell `Get-NetTCPConnection`)
- Node.js nur zum Selberbauen nötig

## Port

Der interne HTTP-Server läuft auf Port `3099` (änderbar über `PM_PORT` in `pm.js`).

