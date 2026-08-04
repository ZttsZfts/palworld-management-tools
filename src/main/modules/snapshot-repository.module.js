'use strict';

const fs = require('node:fs/promises');
const path = require('node:path');

/**
 * 每台服务器使用独立 JSON 文件持久化快照。这样远程服务器离线后，
 * UI 仍可读取最后一次成功同步的服务器、玩家、公会、帕鲁与物品信息。
 */
class SnapshotRepository {
  constructor(app) {
    this.directory = path.join(app.getPath('userData'), 'server-cache');
  }

  async get(connectionId) {
    try {
      return JSON.parse(await fs.readFile(this.pathOf(connectionId), 'utf8'));
    } catch (error) {
      if (error.code === 'ENOENT') return this.empty(connectionId);
      throw error;
    }
  }

  async save(connectionId, snapshot) {
    const previous = await this.get(connectionId);
    const today = this.dateKey(new Date());
    const previousPlayers = new Map((previous.players || []).map((player) => [player.uid, player]));

    // 0 点切换每日等级基线；同一天内始终与当日首次记录对比。
    snapshot.players = (snapshot.players || []).map((player) => {
      const old = previousPlayers.get(player.uid);
      const baseline = old?.levelBaseline?.date === today
        ? old.levelBaseline
        : { date: today, level: old?.level ?? player.level ?? 0 };
      return { ...old, ...player, levelBaseline: baseline, levelGainToday: Math.max(0, (player.level || 0) - baseline.level) };
    });

    const value = { ...snapshot, connectionId, cachedAt: new Date().toISOString() };
    await fs.mkdir(this.directory, { recursive: true });
    await fs.writeFile(this.pathOf(connectionId), JSON.stringify(value, null, 2), 'utf8');
    return value;
  }

  empty(connectionId) {
    return { connectionId, server: {}, players: [], guilds: [], cachedAt: null, online: false };
  }

  pathOf(connectionId) {
    // UUID/内部 ID 之外的字符不允许参与文件路径，防止路径穿越。
    const safeId = String(connectionId).replace(/[^a-zA-Z0-9_-]/g, '_');
    return path.join(this.directory, `${safeId}.json`);
  }

  dateKey(date) {
    return `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}`;
  }
}

module.exports = { SnapshotRepository };
