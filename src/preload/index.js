'use strict';

const { contextBridge, ipcRenderer } = require('electron');

const IPC = Object.freeze({
  APP_GET_INFO: 'app:get-info', CONNECTION_LIST: 'connection:list',
  CONNECTION_SAVE: 'connection:save', CONNECTION_REMOVE: 'connection:remove',
  CONNECTION_TEST: 'connection:test', REST_REQUEST: 'remote:rest-request',
  RCON_COMMAND: 'remote:rcon-command', SNAPSHOT_GET: 'snapshot:get',
  SNAPSHOT_SYNC: 'snapshot:sync', BROADCAST_SEND: 'broadcast:send',
  MOVEMENT_GET: 'movement:get'
});

// 将主进程返回的结果还原为普通 Promise。网络异常在渲染进程边界抛出，
// 避免 Electron 把可预期的离线或超时误报为主进程 IPC 异常。
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
  movement: { get: (request) => invokeResult(IPC.MOVEMENT_GET, request) }
});
