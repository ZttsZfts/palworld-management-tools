'use strict';

const { BrowserWindow } = require('electron');
const path = require('node:path');

class WindowModule {
  constructor(app, templateRenderer) {
    this.app = app;
    this.templateRenderer = templateRenderer;
  }

  async create() {
    const htmlPath = await this.templateRenderer.renderApplication();
    const window = new BrowserWindow({
      width: 1440,
      height: 900,
      minWidth: 1100,
      minHeight: 700,
      show: false,
      titleBarStyle: 'hidden',
      titleBarOverlay: { color: '#0b1019', symbolColor: '#9aa8bb', height: 42 },
      backgroundColor: '#0b1019',
      webPreferences: {
        preload: path.join(__dirname, '../../preload/index.js'),
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: true
      }
    });
    window.once('ready-to-show', () => window.show());
    await window.loadFile(htmlPath);
    if (process.argv.includes('--dev')) window.webContents.openDevTools({ mode: 'detach' });
    return window;
  }
}

module.exports = { WindowModule };
