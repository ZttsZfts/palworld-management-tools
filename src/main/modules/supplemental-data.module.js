'use strict';

const fs = require('node:fs/promises');
const path = require('node:path');
const { PalworldLevelJsonModule } = require('./palworld-level-json.module');

class SupplementalDataModule {
  constructor(app) {
    this.levelJson = new PalworldLevelJsonModule(app ? path.join(app.getPath('userData'), 'level-json-cache') : '');
  }

  async read(connection) {
    const configuredPath = String(connection.supplementalDataPath || '').trim();
    if (!configuredPath) return { configured: false, available: false, players: [], guilds: [] };
    const filePath = path.resolve(configuredPath);
    try {
      const document = this.levelJson.isLevelJson(filePath)
        ? await this.levelJson.read(filePath)
        : JSON.parse(await fs.readFile(filePath, 'utf8'));
      return {
        configured: true,
        available: true,
        source: filePath,
        updatedAt: document.updatedAt || null,
        players: Array.isArray(document.players) ? document.players : [],
        guilds: Array.isArray(document.guilds) ? document.guilds : []
      };
    } catch (error) {
      return { configured: true, available: false, source: filePath, error: error.message, players: [], guilds: [] };
    }
  }
}

module.exports = { SupplementalDataModule };
