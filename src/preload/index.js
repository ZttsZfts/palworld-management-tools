'use strict';

const { contextBridge, ipcRenderer } = require('electron');

const IPC = Object.freeze({
  APP_GET_INFO: 'app:get-info', CONNECTION_LIST: 'connection:list',
  CONNECTION_SAVE: 'connection:save', CONNECTION_REMOVE: 'connection:remove',
  CONNECTION_TEST: 'connection:test', REST_REQUEST: 'remote:rest-request',
  RCON_COMMAND: 'remote:rcon-command', SNAPSHOT_GET: 'snapshot:get',
  SNAPSHOT_SYNC: 'snapshot:sync', BROADCAST_SEND: 'broadcast:send',
  MOVEMENT_GET: 'movement:get', SETTINGS_GET: 'settings:get',
  SETTINGS_SAVE: 'settings:save', STORAGE_SELECT_DIRECTORY: 'storage:select-directory'
});
async function invokeResult(channel, payload) {
  const result = await ipcRenderer.invoke(channel, payload);
  if (!result?.success) {
    const error = new Error(result?.error?.message || 'Remote operation failed');
    error.code = result?.error?.code || '';
    throw error;
  }
  return result.value;
}

contextBridge.exposeInMainWorld('palworldAPI', {
  app: { getInfo: () => ipcRenderer.invoke(IPC.APP_GET_INFO) },
  connections: {
    list: () => ipcRenderer.invoke(IPC.CONNECTION_LIST),
    save: (connection) => ipcRenderer.invoke(IPC.CONNECTION_SAVE, connection),
    remove: (id) => ipcRenderer.invoke(IPC.CONNECTION_REMOVE, id),
    test: (id) => invokeResult(IPC.CONNECTION_TEST, id)
  },
  remote: {
    rest: (request) => invokeResult(IPC.REST_REQUEST, request),
    rcon: (request) => invokeResult(IPC.RCON_COMMAND, request),
    broadcast: (request) => invokeResult(IPC.BROADCAST_SEND, request)
  },
  snapshots: {
    get: (connectionId) => ipcRenderer.invoke(IPC.SNAPSHOT_GET, connectionId),
    sync: (connectionId) => invokeResult(IPC.SNAPSHOT_SYNC, connectionId)
  },
  movement: { get: (request) => invokeResult(IPC.MOVEMENT_GET, request) },
  settings: {
    get: () => ipcRenderer.invoke(IPC.SETTINGS_GET),
    save: (settings) => invokeResult(IPC.SETTINGS_SAVE, settings),
    selectStorageDirectory: () => invokeResult(IPC.STORAGE_SELECT_DIRECTORY)
  }
});
