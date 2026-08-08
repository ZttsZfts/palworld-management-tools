'use strict';

const fs = require('node:fs/promises');
const path = require('node:path');

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
    const normalizeId = (value) => String(value || '').replace(/-/g, '').toLowerCase();
    const previousPlayers = new Map((previous.players || []).map((player) => [normalizeId(player.uid), player]));
    snapshot.players = (snapshot.players || []).map((player) => {
      const old = previousPlayers.get(normalizeId(player.uid));
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
    const safeId = String(connectionId).replace(/[^a-zA-Z0-9_-]/g, '_');
    return path.join(this.directory, `${safeId}.json`);
  }

  dateKey(date) {
    return `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}`;
  }
}

module.exports = { SnapshotRepository };
