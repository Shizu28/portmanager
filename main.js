'use strict';
const { app, BrowserWindow, Tray, Menu, nativeImage, utilityProcess } = require('electron');
const path = require('path');

// Single instance guard
if (!app.requestSingleInstanceLock()) { app.quit(); process.exit(0); }

// Start the HTTP server in a utility process (proper Node.js child, not Electron)
let serverProc = null;
app.whenReady().then(() => {
  serverProc = utilityProcess.fork(path.join(__dirname, 'pm.js'));
});
app.on('will-quit', () => { if (serverProc) serverProc.kill(); });

let tray = null, win = null;

function createWindow() {
  win = new BrowserWindow({
    width: 960,
    height: 640,
    show: false,
    title: 'Port Manager',
    autoHideMenuBar: true,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
    },
  });

  // Small delay so the HTTP server is ready before the window tries to load
  setTimeout(() => win.loadURL('http://localhost:3099'), 800);

  // Hide instead of close (keeps running in tray)
  win.on('close', e => {
    e.preventDefault();
    win.hide();
  });
}

function createTray() {
  const imgPath = path.join(__dirname, 'assets', 'icon.png');
  const img = nativeImage.createFromPath(imgPath).resize({ width: 16, height: 16 });
  tray = new Tray(img);
  tray.setToolTip('Port Manager');

  const menu = Menu.buildFromTemplate([
    { label: 'Öffnen', click: () => { win.show(); win.focus(); } },
    { type: 'separator' },
    { label: 'Beenden', click: () => app.exit(0) },
  ]);
  tray.setContextMenu(menu);

  tray.on('click', () => {
    win.isVisible() ? win.focus() : win.show();
  });
}

app.whenReady().then(() => {
  app.setAppUserModelId('Port Manager');
  createWindow();
  createTray();
  // Show window on first launch
  setTimeout(() => win.show(), 500);
});

// Focus existing window if user tries to open a second instance
app.on('second-instance', () => {
  if (win) { win.show(); win.focus(); }
});

// Keep running when all windows are closed (lives in tray)
app.on('window-all-closed', e => e.preventDefault());
