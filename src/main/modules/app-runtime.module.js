'use strict';

const { BrowserWindow } = require('electron');
const { ConfigRepository } = require('./config-repository.module');
const { IpcModule } = require('./ipc.module');
const { RconClient } = require('./rcon-client.module');
const { RestClient } = require('./rest-client.module');
const { RemoteDataModule } = require('./remote-data.module');
const { SnapshotRepository } = require('./snapshot-repository.module');
const { SupplementalDataModule } = require('./supplemental-data.module');
const { MovementPathRepository } = require('./movement-path-repository.module');
const { TemplateRenderer } = require('./template-renderer.module');
const { WindowModule } = require('./window.module');

class AppRuntime {
  constructor(app) {
    this.app = app;
    this.ipc = null;
    this.windowModule = null;
  }

  initialize() {
    const repository = new ConfigRepository(this.app);
    const snapshots = new SnapshotRepository(this.app);
    const restClient = new RestClient();
    const movementPaths = new MovementPathRepository(this.app);
    const renderer = new TemplateRenderer(this.app);
    this.windowModule = new WindowModule(this.app, renderer);
    this.ipc = new IpcModule({
      app: this.app,
      repository,
      restClient,
      rconClient: new RconClient(),
      snapshots,
      movementPaths,
      remoteData: new RemoteDataModule(restClient, snapshots, new SupplementalDataModule(this.app), movementPaths)
    });
  }

  registerIpc() {
    this.ipc.register();
  }

  manageLifecycle() {
    this.app.whenReady().then(() => {
      this.windowModule.create();
      this.app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) this.windowModule.create();
      });
    });

    this.app.on('before-quit', () => this.ipc.dispose());
    this.app.on('window-all-closed', () => {
      if (process.platform !== 'darwin') this.app.quit();
    });
  }
}

module.exports = { AppRuntime };
