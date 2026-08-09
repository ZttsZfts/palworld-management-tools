'use strict';

const fs = require('node:fs');
const fsp = require('node:fs/promises');
const path = require('node:path');

class SettingsRepository {
  constructor(app, storagePaths) {
    this.filePath = path.join(app.getPath('userData'), 'app-settings.json');
    this.storagePaths = storagePaths;
    this.value = this.readSync();
    this.storagePaths.setRoot(this.value.storageRoot);
  }

  defaults() {
    return { theme: 'dark', storageRoot: '' };
  }

  readSync() {
    try {
      return this.validate({ ...this.defaults(), ...JSON.parse(fs.readFileSync(this.filePath, 'utf8')) });
    } catch (error) {
      if (error.code === 'ENOENT') return this.defaults();
      throw new Error(`读取应用设置失败：${error.message}`);
    }
  }

  get() {
    return { ...this.value, ...this.storagePaths.describe(this.filePath) };
  }

  async save(input = {}) {
    const next = this.validate({ ...this.value, ...input });
    const targetRoot = next.storageRoot ? path.resolve(next.storageRoot) : this.storagePaths.defaultRoot;
    await fsp.mkdir(targetRoot, { recursive: true });
    await fsp.access(targetRoot, fs.constants.R_OK | fs.constants.W_OK);
    await fsp.mkdir(path.dirname(this.filePath), { recursive: true });
    await fsp.writeFile(this.filePath, JSON.stringify(next, null, 2), 'utf8');
    this.value = next;
    this.storagePaths.setRoot(next.storageRoot);
    return this.get();
  }

  validate(input) {
    const theme = input.theme === 'light' ? 'light' : 'dark';
    const storageRoot = String(input.storageRoot || '').trim();
    if (storageRoot && !path.isAbsolute(storageRoot)) throw new Error('数据根目录必须使用绝对路径');
    return { theme, storageRoot };
  }
}

module.exports = { SettingsRepository };
