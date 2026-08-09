'use strict';

const fs = require('node:fs/promises');
const path = require('node:path');

class MovementPathRepository {
  constructor(storagePaths) {
    this.storagePaths = storagePaths;
    this.lastCleanup = new Map();
    this.lastPoints = new Map();
    this.retentionMs = 7 * 24 * 60 * 60 * 1000;
  }

  get directory() { return this.storagePaths.movement(); }

  async record(connectionId, players, capturedAt = Date.now()) {
    const date = this.dateKey(new Date(capturedAt));
    const connectionDirectory = path.join(this.directory, this.safe(connectionId));
    const writes = players.filter((player) => player.online && player.hasLocation).map(async (player) => {
      const pointKey = `${connectionId}:${player.uid}`;
      const previous = this.lastPoints.get(pointKey);
      if (previous && previous.x === player.x && previous.y === player.y && capturedAt - previous.t < 60000) return;
      this.lastPoints.set(pointKey, { x: player.x, y: player.y, t: capturedAt });
      const playerDirectory = path.join(connectionDirectory, this.safe(player.uid));
      await fs.mkdir(playerDirectory, { recursive: true });
      const point = {
        t: capturedAt,
        x: player.x,
        y: player.y,
        n: player.name,
        uid: player.uid,
        userId: player.userId || '',
        steam64: player.steam64 || ''
      };
      await fs.appendFile(path.join(playerDirectory, `${date}.jsonl`), `${JSON.stringify(point)}\n`, 'utf8');
    });
    await Promise.all(writes);
    await this.cleanupOccasionally(connectionId, capturedAt);
  }

  async getPaths(connectionId, options = {}) {
    const now = Date.now();
    const requestedSince = Math.max(now - this.retentionMs, Number(options.since) || now - 24 * 60 * 60 * 1000);
    const requestedIds = Array.isArray(options.playerIds) ? new Set(options.playerIds.map((value) => this.normalize(value))) : null;
    const identities = this.identities(options.players);
    const base = path.join(this.directory, this.safe(connectionId));
    const directories = await this.directories(base);
    let paths = [];
    let totalPoints = 0;
    let overloaded = false;

    for (const directory of directories) {
      const remainingBudget = requestedIds?.size ? Infinity : Math.max(1, 20001 - totalPoints);
      const points = await this.readPlayer(path.join(base, directory.name), requestedSince, remainingBudget);
      const identity = this.resolveIdentity(directory.name, points.at(-1), identities);
      if (requestedIds?.size && !requestedIds.has(identity.uid)) continue;
      totalPoints += points.length;
      if (points.length) paths.push({ uid: identity.uid, name: identity.name, points });
      if (!requestedIds?.size && totalPoints > 20000) { overloaded = true; break; }
    }

    const effectiveSince = overloaded ? now - 5 * 60 * 1000 : requestedSince;
    if (overloaded) {
      paths = [];
      for (const directory of directories) {
        const points = await this.readPlayer(path.join(base, directory.name), effectiveSince);
        const identity = this.resolveIdentity(directory.name, points.at(-1), identities);
        if (points.length) paths.push({ uid: identity.uid, name: identity.name, points });
      }
    }
    paths = this.mergeIdentityPaths(paths);
    const result = paths.map((item) => {
      const visible = item.points.filter((point) => point.t >= effectiveSince);
      return {
        uid: item.uid,
        name: item.name,
        points: this.downsample(visible, 1800),
        anomalies: this.detectAnomalies(visible, Number(options.jumpDistance) || 1000, Number(options.maxJumpSeconds) || 15)
      };
    }).filter((item) => item.points.length);

    return { paths: result, requestedSince, effectiveSince, totalPoints, truncatedToFiveMinutes: overloaded, generatedAt: now };
  }

  async readPlayer(directory, since, limit = Infinity) {
    const files = (await this.files(directory)).filter((file) => file.name.endsWith('.jsonl')).sort((a, b) => a.name.localeCompare(b.name));
    const points = [];
    for (const file of files) {
      const text = await fs.readFile(path.join(directory, file.name), 'utf8');
      for (const line of text.split(/\r?\n/)) {
        if (!line) continue;
        try {
          const point = JSON.parse(line);
          if (point.t >= since) points.push(point);
          if (points.length > limit) return points;
        } catch {  }
      }
    }
    return points.sort((a, b) => a.t - b.t);
  }

  detectAnomalies(points, distanceThreshold, maxSeconds) {
    const anomalies = [];
    for (let index = 1; index < points.length; index += 1) {
      const from = points[index - 1];
      const to = points[index];
      const seconds = (to.t - from.t) / 1000;
      const distance = Math.hypot(to.x - from.x, to.y - from.y);
      if (seconds > 0 && seconds <= maxSeconds && distance >= distanceThreshold) anomalies.push({ from, to, seconds, distance });
    }
    return anomalies;
  }

  downsample(points, limit) {
    if (points.length <= limit) return points;
    const step = (points.length - 1) / (limit - 1);
    return Array.from({ length: limit }, (_value, index) => points[Math.round(index * step)]);
  }

  identities(players) {
    const values = Array.isArray(players) ? players : [];
    const nameCounts = new Map();
    const byAlias = new Map();
    for (const player of values) {
      const name = String(player?.name || '').trim();
      const nameKey = name.toLowerCase();
      if (nameKey) nameCounts.set(nameKey, (nameCounts.get(nameKey) || 0) + 1);
    }
    for (const player of values) {
      const identity = {
        uid: this.normalize(player?.uid),
        name: String(player?.name || player?.uid || '').trim()
      };
      for (const alias of this.identityAliases(player).filter((value) => !value.startsWith('name:'))) byAlias.set(alias, identity);
      const nameKey = identity.name.toLowerCase();
      if (nameKey && nameCounts.get(nameKey) === 1) byAlias.set(`name:${nameKey}`, identity);
    }
    return byAlias;
  }

  resolveIdentity(directoryUid, point, identities) {
    const fallbackUid = this.normalize(directoryUid);
    const fallbackName = String(point?.n || directoryUid);
    const aliases = this.identityAliases({
      uid: point?.uid || directoryUid,
      userId: point?.userId,
      steam64: point?.steam64,
      name: fallbackName
    });
    const current = aliases.map((alias) => identities.get(alias)).find(Boolean);
    return current || { uid: fallbackUid, name: fallbackName };
  }

  identityAliases(player) {
    const aliases = [];
    const uid = this.normalize(player?.uid);
    const userId = String(player?.userId || '').trim().toLowerCase();
    const steam64 = String(player?.steam64 || '').trim();
    const name = String(player?.name || '').trim().toLowerCase();
    if (uid) aliases.push(`uid:${uid}`);
    if (userId) aliases.push(`user:${userId}`);
    if (steam64) aliases.push(`steam:${steam64}`);
    if (name) aliases.push(`name:${name}`);
    return aliases;
  }

  mergeIdentityPaths(paths) {
    const merged = new Map();
    for (const pathItem of paths) {
      const existing = merged.get(pathItem.uid);
      if (existing) existing.points.push(...pathItem.points);
      else merged.set(pathItem.uid, { ...pathItem, points: [...pathItem.points] });
    }
    return [...merged.values()].map((item) => ({
      ...item,
      points: item.points.sort((left, right) => left.t - right.t)
    }));
  }

  async cleanupOccasionally(connectionId, now) {
    if (now - (this.lastCleanup.get(connectionId) || 0) < 60 * 60 * 1000) return;
    this.lastCleanup.set(connectionId, now);
    const base = path.join(this.directory, this.safe(connectionId));
    const cutoff = new Date(now);
    cutoff.setHours(0, 0, 0, 0);
    cutoff.setDate(cutoff.getDate() - 6);
    for (const player of await this.directories(base)) {
      const playerDirectory = path.join(base, player.name);
      for (const file of await this.files(playerDirectory)) {
        const match = file.name.match(/^(\d{4}-\d{2}-\d{2})\.jsonl$/);
        if (match && new Date(`${match[1]}T00:00:00`).getTime() < cutoff.getTime()) await fs.unlink(path.join(playerDirectory, file.name));
      }
    }
  }

  async directories(directory) { try { return (await fs.readdir(directory, { withFileTypes: true })).filter((entry) => entry.isDirectory()); } catch (error) { if (error.code === 'ENOENT') return []; throw error; } }
  async files(directory) { try { return (await fs.readdir(directory, { withFileTypes: true })).filter((entry) => entry.isFile()); } catch (error) { if (error.code === 'ENOENT') return []; throw error; } }
  safe(value) { return String(value).replace(/[^a-zA-Z0-9_-]/g, '_'); }
  normalize(value) { return String(value || '').replace(/-/g, '').toLowerCase(); }
  dateKey(date) { return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`; }
}

module.exports = { MovementPathRepository };
