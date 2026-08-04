'use strict';

const fs = require('node:fs/promises');
const path = require('node:path');

/**
 * Reads optional advanced data exported by a save parser or companion service.
 * Keeping this provider separate prevents unofficial fields from contaminating
 * the official REST model and makes a future Level.sav provider replaceable.
 */
class SupplementalDataModule {
  async read(connection) {
    const configuredPath = String(connection.supplementalDataPath || '').trim();
    if (!configuredPath) return { configured: false, available: false, players: [], guilds: [] };
    const filePath = path.resolve(configuredPath);
    try {
      const document = JSON.parse(await fs.readFile(filePath, 'utf8'));
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
