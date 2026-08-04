'use strict';

const fs = require('node:fs/promises');
const path = require('node:path');
const crypto = require('node:crypto');

class ConfigRepository {
  constructor(app) {
    this.filePath = path.join(app.getPath('userData'), 'connections.json');
  }

  async list() {
    try {
      const data = JSON.parse(await fs.readFile(this.filePath, 'utf8'));
      return Array.isArray(data) ? data : [];
    } catch (error) {
      if (error.code === 'ENOENT') return [];
      throw error;
    }
  }

  async save(input) {
    const connection = this.validate(input);
    const connections = await this.list();
    const index = connections.findIndex((item) => item.id === connection.id);
    if (index >= 0) connections[index] = connection;
    else connections.push(connection);
    await this.write(connections);
    return connection;
  }

  async remove(id) {
    const connections = (await this.list()).filter((item) => item.id !== id);
    await this.write(connections);
    return true;
  }

  async get(id) {
    return (await this.list()).find((item) => item.id === id) || null;
  }

  validate(input = {}) {
    const name = String(input.name || '').trim();
    const host = String(input.host || '').trim();
    if (!name || !host) throw new Error('名称和主机地址不能为空');
    return {
      id: input.id || crypto.randomUUID(),
      name,
      host,
      restPort: Number(input.restPort) || 8212,
      rconPort: Number(input.rconPort) || 25575,
      username: String(input.username || 'admin'),
      password: String(input.password || ''),
      useHttps: Boolean(input.useHttps),
      supplementalDataPath: String(input.supplementalDataPath || '').trim(),
      updatedAt: new Date().toISOString()
    };
  }

  async write(connections) {
    await fs.mkdir(path.dirname(this.filePath), { recursive: true });
    await fs.writeFile(this.filePath, JSON.stringify(connections, null, 2), 'utf8');
  }
}

module.exports = { ConfigRepository };
