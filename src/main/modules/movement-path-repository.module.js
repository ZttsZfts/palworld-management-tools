'use strict';

const fs = require('node:fs/promises');
const path = require('node:path');

/**
 * Stores movement points as daily JSONL files per player. Appending one line is
 * cheaper than rewriting a large JSON array every three seconds, and separate
 * files let the reader load only requested players/dates.
 */
class MovementPathRepository {
  constructor(app) {
    this.directory = path.join(app.getPath('userData'), 'movement-paths');
    this.lastCleanup = new Map();
    this.lastPoints = new Map();
    this.retentionMs = 7 * 24 * 60 * 60 * 1000;
  }

  async record(connectionId, players, capturedAt = Date.now()) {
    const date = this.dateKey(new Date(capturedAt));
    const connectionDirectory = path.join(this.directory, this.safe(connectionId));
    const writes = players.filter((player) => player.online && player.hasLocation).map(async (player) => {
      const pointKey = `${connectionId}:${player.uid}`;
      const previous = this.lastPoints.get(pointKey);
      // Stationary samples add no path information. Keep one heartbeat per
      // minute so an extended stationary period remains visible in history.
      if (previous && previous.x === player.x && previous.y === player.y && capturedAt - previous.t < 60000) return;
      this.lastPoints.set(pointKey, { x: player.x, y: player.y, t: capturedAt });
      const playerDirectory = path.join(connectionDirectory, this.safe(player.uid));
      await fs.mkdir(playerDirectory, { recursive: true });
      const point = { t: capturedAt, x: player.x, y: player.y, n: player.name };
      await fs.appendFile(path.join(playerDirectory, `${date}.jsonl`), `${JSON.stringify(point)}\n`, 'utf8');
    });
    await Promise.all(writes);
    await this.cleanupOccasionally(connectionId, capturedAt);
  }

  async getPaths(connectionId, options = {}) {
    const now = Date.now();
    const requestedSince = Math.max(now - this.retentionMs, Number(options.since) || now - 24 * 60 * 60 * 1000);
    const requestedIds = Array.isArray(options.playerIds) ? new Set(options.playerIds.map(String)) : null;
    const base = path.join(this.directory, this.safe(connectionId));
    const directories = await this.directories(base);
    let paths = [];
    let totalPoints = 0;
    let overloaded = false;

    for (const directory of directories) {
      const uid = directory.name;
      if (requestedIds?.size && !requestedIds.has(uid)) continue;
      const remainingBudget = requestedIds?.size ? Infinity : Math.max(1, 20001 - totalPoints);
      const points = await this.readPlayer(path.join(base, uid), requestedSince, remainingBudget);
      totalPoints += points.length;
      if (points.length) paths.push({ uid, name: points.at(-1).n || uid, points });
      if (!requestedIds?.size && totalPoints > 20000) { overloaded = true; break; }
    }

    const effectiveSince = overloaded ? now - 5 * 60 * 1000 : requestedSince;
    if (overloaded) {
      paths = [];
      for (const directory of directories) {
        const points = await this.readPlayer(path.join(base, directory.name), effectiveSince);
        if (points.length) paths.push({ uid: directory.name, name: points.at(-1).n || directory.name, points });
      }
    }
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
        } catch { /* Ignore an incomplete final append. */ }
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

  async cleanupOccasionally(connectionId, now) {
    if (now - (this.lastCleanup.get(connectionId) || 0) < 60 * 60 * 1000) return;
    this.lastCleanup.set(connectionId, now);
    const base = path.join(this.directory, this.safe(connectionId));
    const cutoff = new Date(now);
    cutoff.setHours(0, 0, 0, 0);
    cutoff.setDate(cutoff.getDate() - 6); // Today plus six previous calendar days.
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
  dateKey(date) { return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`; }
}

module.exports = { MovementPathRepository };
