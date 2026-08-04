'use strict';

const fs = require('node:fs');
const fsp = require('node:fs/promises');
const path = require('node:path');
const crypto = require('node:crypto');

const ZERO_GUID = '00000000-0000-0000-0000-000000000000';

/**
 * Converts PalworldSaveTools' very large Level.json without loading the whole
 * document into memory. Only the two map arrays needed by the UI are decoded;
 * every array element is released immediately after it has been normalized.
 */
class PalworldLevelJsonModule {
  constructor(cacheDirectory = '') {
    this.jobs = new Map();
    this.cacheDirectory = cacheDirectory;
  }

  isLevelJson(filePath) {
    return /(?:^|[\\/])Level\.json$/i.test(filePath);
  }

  async read(filePath) {
    const sourceStat = await fsp.stat(filePath);
    const cacheName = `${crypto.createHash('sha1').update(filePath).digest('hex')}.json`;
    const cachePath = this.cacheDirectory
      ? path.join(this.cacheDirectory, cacheName)
      : `${filePath}.palstudio-cache.json`;
    const cached = await this.readFreshCache(cachePath, sourceStat);
    if (cached) return cached;

    // Multiple three-second synchronizations must share one extraction job.
    if (!this.jobs.has(filePath)) {
      const job = this.extract(filePath, sourceStat, cachePath)
        .finally(() => this.jobs.delete(filePath));
      this.jobs.set(filePath, job);
    }
    return this.jobs.get(filePath);
  }

  async readFreshCache(cachePath, sourceStat) {
    try {
      const document = JSON.parse(await fsp.readFile(cachePath, 'utf8'));
      if (document.sourceSize === sourceStat.size && document.sourceMtimeMs === sourceStat.mtimeMs) return document;
    } catch (_) {
      // A missing, stale or interrupted cache is rebuilt from Level.json.
    }
    return null;
  }

  async extract(filePath, sourceStat, cachePath) {
    const players = new Map();
    const palsByOwner = new Map();
    const guilds = [];

    await this.readMap(filePath, 'CharacterSaveParameterMap', (entry) => {
      const uid = this.valueAt(entry, ['key', 'PlayerUId']) || '';
      const instanceId = this.valueAt(entry, ['key', 'InstanceId']) || '';
      const save = entry?.value?.RawData?.value?.object?.SaveParameter?.value;
      if (!save) return;

      if (save.IsPlayer?.value === true && uid && uid !== ZERO_GUID) {
        players.set(uid, {
          playerId: uid,
          name: this.propertyValue(save.NickName) || this.propertyValue(save.FilteredNickName) || '未知玩家',
          level: Number(this.propertyValue(save.Level)) || 0,
          instanceId,
          pals: [],
          items: []
        });
        return;
      }

      const owner = this.propertyValue(save.OwnerPlayerUId);
      if (!owner || owner === ZERO_GUID) return;
      const list = palsByOwner.get(owner) || [];
      list.push({
        id: instanceId,
        name: this.propertyValue(save.NickName) || this.propertyValue(save.CharacterID) || '未知帕鲁',
        characterId: this.propertyValue(save.CharacterID) || '',
        level: Number(this.propertyValue(save.Level)) || 0
      });
      palsByOwner.set(owner, list);
    });

    await this.readMap(filePath, 'GroupSaveDataMap', (entry) => {
      const raw = entry?.value?.RawData?.value;
      if (raw?.group_type !== 'EPalGroupType::Guild') return;
      const members = Array.isArray(raw.players) ? raw.players : [];
      const memberIds = members.map((member) => String(member.player_uid || '')).filter(Boolean);
      guilds.push({
        id: String(raw.group_id || entry.key || ''),
        name: raw.guild_name || raw.group_name || '未命名公会',
        level: Number(raw.base_camp_level) || 0,
        memberIds
      });
      for (const member of members) {
        const uid = String(member.player_uid || '');
        if (!uid) continue;
        const player = players.get(uid) || { playerId: uid, level: 0, pals: [], items: [] };
        player.name = player.name || member.player_info?.player_name || '未知玩家';
        player.guildId = String(raw.group_id || entry.key || '');
        player.guildName = raw.guild_name || raw.group_name || '未命名公会';
        players.set(uid, player);
      }
    });

    for (const [uid, pals] of palsByOwner) {
      const player = players.get(uid);
      if (player) player.pals = pals;
    }

    const document = {
      updatedAt: new Date().toISOString(),
      source: filePath,
      sourceSize: sourceStat.size,
      sourceMtimeMs: sourceStat.mtimeMs,
      players: [...players.values()],
      guilds
    };
    await this.atomicWrite(cachePath, document);
    return document;
  }

  /** Streams the top-level objects in a named map's `value` array. */
  async readMap(filePath, mapName, visit) {
    const stream = fs.createReadStream(filePath, { encoding: 'utf8', highWaterMark: 1024 * 1024 });
    const marker = `\"${mapName}\"`;
    let phase = 'marker';
    let pending = '';
    let item = '';
    let depth = 0;
    let inString = false;
    let escaped = false;

    for await (const chunk of stream) {
      let text = pending + chunk;
      pending = '';
      if (phase === 'marker') {
        const markerIndex = text.indexOf(marker);
        if (markerIndex < 0) {
          pending = text.slice(-marker.length);
          continue;
        }
        text = text.slice(markerIndex + marker.length);
        phase = 'array';
      }
      if (phase === 'array') {
        const match = /\"value\"\s*:\s*\[/.exec(text);
        if (!match) {
          pending = text.slice(-64);
          continue;
        }
        text = text.slice(match.index + match[0].length);
        phase = 'items';
      }

      for (const character of text) {
        if (depth === 0) {
          if (character === ']') return;
          if (character !== '{') continue;
          depth = 1;
          item = '{';
          continue;
        }
        item += character;
        if (inString) {
          if (escaped) escaped = false;
          else if (character === '\\') escaped = true;
          else if (character === '"') inString = false;
          continue;
        }
        if (character === '"') inString = true;
        else if (character === '{' || character === '[') depth += 1;
        else if (character === '}' || character === ']') depth -= 1;
        if (depth === 0) {
          visit(JSON.parse(item));
          item = '';
        }
      }
    }
    throw new Error(`Level.json 中未找到完整的 ${mapName}.value 数组`);
  }

  propertyValue(property) {
    let value = property?.value;
    while (value && typeof value === 'object' && !Array.isArray(value) && Object.hasOwn(value, 'value')) value = value.value;
    return value;
  }

  valueAt(object, path) {
    return this.propertyValue(path.reduce((value, key) => value?.[key], object));
  }

  async atomicWrite(filePath, value) {
    await fsp.mkdir(path.dirname(filePath), { recursive: true });
    const temporary = `${filePath}.${process.pid}.tmp`;
    await fsp.writeFile(temporary, JSON.stringify(value), 'utf8');
    await fsp.rm(filePath, { force: true });
    await fsp.rename(temporary, filePath);
  }
}

module.exports = { PalworldLevelJsonModule };
