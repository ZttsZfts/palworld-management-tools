'use strict';

const fs = require('node:fs/promises');
const path = require('node:path');
const crypto = require('node:crypto');

class ConfigRepository {
  constructor(storagePaths, credentialStorage = null) {
    this.storagePaths = storagePaths;
    this.credentialStorage = credentialStorage;
  }

  get filePath() { return this.storagePaths.connections(); }

  async list() {
    try {
      const data = JSON.parse(await fs.readFile(this.filePath, 'utf8'));
      if (!Array.isArray(data)) return [];
      const connections = data.map((connection) => this.decrypt(connection));
      const hasUnprotectedPassword = data.some((connection) => connection.password && !connection.encryptedPassword);
      if (hasUnprotectedPassword && this.credentialStorage?.isEncryptionAvailable()) await this.write(connections);
      return connections;
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
      syncIntervalSeconds: Math.max(1, Number(input.syncIntervalSeconds) || 3),
      updatedAt: new Date().toISOString()
    };
  }

  async write(connections) {
    await fs.mkdir(path.dirname(this.filePath), { recursive: true });
    await fs.writeFile(this.filePath, JSON.stringify(connections.map((connection) => this.encrypt(connection)), null, 2), 'utf8');
  }

  encrypt(connection) {
    const stored = { ...connection };
    if (!stored.password || !this.credentialStorage?.isEncryptionAvailable()) return stored;
    stored.encryptedPassword = this.credentialStorage.encryptString(stored.password).toString('base64');
    stored.credentialProtection = 'electron-safe-storage';
    delete stored.password;
    return stored;
  }

  decrypt(connection) {
    if (!connection?.encryptedPassword) return connection;
    if (!this.credentialStorage?.isEncryptionAvailable()) {
      throw new Error('系统凭据保护当前不可用，无法读取已保存的服务器密码');
    }
    try {
      const password = this.credentialStorage.decryptString(Buffer.from(connection.encryptedPassword, 'base64'));
      const value = { ...connection, password };
      delete value.encryptedPassword;
      delete value.credentialProtection;
      return value;
    } catch (error) {
      throw new Error(`服务器密码解密失败：${error.message}`);
    }
  }
}

module.exports = { ConfigRepository };
