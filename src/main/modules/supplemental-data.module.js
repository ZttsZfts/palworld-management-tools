'use strict';

const fs = require('node:fs/promises');
const path = require('node:path');
const { PalworldLevelJsonModule } = require('./palworld-level-json.module');

/**
 * Reads optional advanced data exported by a save parser or companion service.
 * Keeping this provider separate prevents unofficial fields from contaminating
 * the official REST model and makes a future Level.sav provider replaceable.
 */
class SupplementalDataModule {
  constructor(app) {
    this.levelJson = new PalworldLevelJsonModule(app ? path.join(app.getPath('userData'), 'level-json-cache') : '');
  }

  async read(connection) {
    const configuredPath = String(connection.supplementalDataPath || '').trim();
    if (!configuredPath) return { configured: false, available: false, players: [], guilds: [] };
    const filePath = path.resolve(configuredPath);
    try {
      // Raw Level.json exports can exceed 800 MB. They are streamed into a
      // compact sidecar cache instead of being passed to JSON.parse at once.
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
