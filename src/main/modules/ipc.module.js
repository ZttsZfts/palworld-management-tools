'use strict';

const { ipcMain } = require('electron');
const IPC = require('../../shared/ipc');

class IpcModule {
  constructor({ app, repository, restClient, rconClient, snapshots, remoteData }) {
    Object.assign(this, { app, repository, restClient, rconClient, snapshots, remoteData });
    this.channels = [];
  }

  register() {
    this.handle(IPC.APP_GET_INFO, () => ({ name: this.app.getName(), version: this.app.getVersion(), platform: process.platform }));
    this.handle(IPC.CONNECTION_LIST, () => this.repository.list());
    this.handle(IPC.CONNECTION_SAVE, (_event, connection) => this.repository.save(connection));
    this.handle(IPC.CONNECTION_REMOVE, (_event, id) => this.repository.remove(id));
    this.handleResult(IPC.CONNECTION_TEST, async (_event, id) => {
      const connection = await this.requireConnection(id);
      const started = Date.now();
      await this.restClient.request(connection, { endpoint: '/info' });
      return { latency: Date.now() - started };
    });
    this.handleResult(IPC.REST_REQUEST, async (_event, { connectionId, ...request }) => this.restClient.request(await this.requireConnection(connectionId), request));
    this.handleResult(IPC.RCON_COMMAND, async (_event, { connectionId, command }) => this.rconClient.execute(await this.requireConnection(connectionId), command));
    this.handle(IPC.SNAPSHOT_GET, (_event, connectionId) => this.snapshots.get(connectionId));
    this.handleResult(IPC.SNAPSHOT_SYNC, async (_event, connectionId) => this.remoteData.sync(await this.requireConnection(connectionId)));
    this.handleResult(IPC.BROADCAST_SEND, async (_event, { connectionId, message }) => {
      const text = String(message || '').trim();
      if (!text) throw new Error('\u5e7f\u64ad\u5185\u5bb9\u4e0d\u80fd\u4e3a\u7a7a');
      if (text.length > 500) throw new Error('\u5e7f\u64ad\u5185\u5bb9\u4e0d\u80fd\u8d85\u8fc7 \u0035\u0030\u0030 \u4e2a\u5b57\u7b26');
      return this.restClient.request(await this.requireConnection(connectionId), { endpoint: '/announce', method: 'POST', body: { message: text } });
    });
  }

  handle(channel, listener) {
    ipcMain.handle(channel, listener);
    this.channels.push(channel);
  }

  // Expected network failures are returned as data so Electron does not print
  // "Error occurred in handler" for normal offline/timeout conditions.
  handleResult(channel, listener) {
    this.handle(channel, async (...args) => {
      try { return { success: true, value: await listener(...args) }; }
      catch (error) { return { success: false, error: { message: error instanceof Error ? error.message : String(error), code: error?.code || '' } }; }
    });
  }

  async requireConnection(id) {
    const connection = await this.repository.get(id);
    if (!connection) throw new Error('\u672a\u627e\u5230\u670d\u52a1\u5668\u8fde\u63a5\u914d\u7f6e');
    return connection;
  }

  dispose() {
    this.channels.forEach((channel) => ipcMain.removeHandler(channel));
    this.channels = [];
  }
}

module.exports = { IpcModule };
