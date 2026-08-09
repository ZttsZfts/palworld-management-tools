'use strict';

window.ApplicationModule = class ApplicationModule {
  constructor() {
    if (!window.palworldAPI) throw new Error('Electron IPC 初始化失败');
    this.api = window.palworldAPI;
    this.state = new window.AppState();
    this.modal = new window.ModalModule();
    this.navigation = new window.NavigationModule(this.state);
    this.connections = new window.ConnectionsModule(this.api, this.state, this.modal);
    this.data = new window.DataModule(this.api, this.state, this.modal, this.navigation);
    this.movement = new window.MovementModule(this.api, this.state, this.modal);
    this.remote = new window.RemoteModule(this.api, this.state, this.modal, this.navigation);
    this.settings = new window.SettingsModule(this.api, this.modal, async () => {
      await this.connections.load();
      await this.data.load();
    });
  }

  async initialize() {
    this.navigation.register();
    this.connections.register();
    this.data.register();
    this.movement.register();
    this.remote.register();
    this.settings.register();
    await this.settings.load();
    await this.connections.load();
    await this.data.load();
    const info = await this.api.app.getInfo();
    $('#app-version').text(`版本 ${info.version} · ${info.platform}`);
  }

};
