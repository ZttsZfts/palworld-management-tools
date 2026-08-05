'use strict';

const fs = require('node:fs/promises');
const path = require('node:path');
const { PalworldLevelJsonModule } = require('./palworld-level-json.module');

/**
 * 读取存档解析器或配套服务导出的扩展数据。
 * 扩展数据与官方 REST 数据分开处理，便于单独更换存档解析方式。
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
      // Level.json 通常很大，因此先流式转换为紧凑缓存，不能直接整体交给 JSON.parse。
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
