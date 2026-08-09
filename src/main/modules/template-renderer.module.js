'use strict';

const ejs = require('ejs');
const fs = require('node:fs/promises');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

class TemplateRenderer {
  constructor(app, storagePaths, settings) {
    this.app = app;
    this.appPath = app.getAppPath();
    this.storagePaths = storagePaths;
    this.settings = settings;
  }

  theme() { return this.settings.get().theme; }

  async renderApplication() {
    const template = path.join(this.appPath, 'src/public/common/app.ejs');
    const outputDirectory = this.storagePaths.renderer();
    const output = path.join(outputDirectory, 'index.html');
    await fs.mkdir(outputDirectory, { recursive: true });
    const asset = (relativePath) => pathToFileURL(path.join(this.appPath, relativePath)).href;
    const html = await ejs.renderFile(template, {
      appName: '幻兽帕鲁管理工具',
      theme: this.settings.get().theme,
      asset,
      pages: [
        { id: 'dashboard', icon: 'grid-1x2', label: '概览' },
        { id: 'servers', icon: 'hdd-rack', label: '服务器' },
        { id: 'players', icon: 'people', label: '玩家' },
        { id: 'guilds', icon: 'shield-shaded', label: '公会' },
        { id: 'movement', icon: 'map', label: '移动轨迹' },
        { id: 'console', icon: 'terminal', label: '控制台' },
        { id: 'backups', icon: 'archive', label: '备份' },
        { id: 'settings', icon: 'sliders', label: '设置' }
      ]
    }, { filename: template });
    await fs.writeFile(output, html, 'utf8');
    return output;
  }
}

module.exports = { TemplateRenderer };
