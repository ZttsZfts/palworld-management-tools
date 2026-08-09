'use strict';

const path = require('node:path');

class StoragePaths {
  constructor(app, storageRoot = '') {
    this.defaultRoot = path.resolve(app.getPath('userData'));
    this.setRoot(storageRoot);
  }

  setRoot(storageRoot = '') {
    const value = String(storageRoot || '').trim();
    this.root = value ? path.resolve(value) : this.defaultRoot;
  }

  connections() { return path.join(this.root, 'connections.json'); }
  snapshots() { return path.join(this.root, 'server-cache'); }
  movement() { return path.join(this.root, 'movement-paths'); }
  levelJson() { return path.join(this.root, 'level-json-cache'); }
  renderer() { return path.join(this.root, 'renderer'); }

  describe(settingsFile) {
    return {
      storageRoot: this.root,
      defaultStorageRoot: this.defaultRoot,
      settingsFile,
      connectionsFile: this.connections(),
      snapshotDirectory: this.snapshots(),
      movementDirectory: this.movement(),
      levelJsonCacheDirectory: this.levelJson(),
      rendererCacheDirectory: this.renderer()
    };
  }
}

module.exports = { StoragePaths };
