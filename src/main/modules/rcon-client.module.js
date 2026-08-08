'use strict';

const net = require('node:net');
const crypto = require('node:crypto');

class RconClient {
  execute(connection, command) {
    const normalizedCommand = String(command || '').trim();
    if (!normalizedCommand) return Promise.reject(new Error('\u0052\u0043\u004f\u004e \u547d\u4ee4\u4e0d\u80fd\u4e3a\u7a7a'));

    return new Promise((resolve, reject) => {
      const socket = net.createConnection({ host: connection.host, port: Number(connection.rconPort) });
      const authId = crypto.randomInt(1, 0x7ffffffe);
      const commandId = authId + 1;
      let buffer = Buffer.alloc(0);
      let output = '';
      let authenticated = false;
      let settled = false;
      let responseTimer;

      const finish = (error, result) => {
        if (settled) return;
        settled = true;
        clearTimeout(responseTimer);
        socket.destroy();
        if (error) reject(error); else resolve(result);
      };
      socket.setTimeout(6000);
      socket.setNoDelay(true);
      socket.once('timeout', () => finish(new Error('\u0052\u0043\u004f\u004e \u8fde\u63a5\u8d85\u65f6\uff0c\u8bf7\u68c0\u67e5\u4e3b\u673a\u5730\u5740\u3001\u7aef\u53e3\u548c\u9632\u706b\u5899')));
      socket.once('connect', () => {
        socket.setTimeout(0);
        socket.write(this.packet(authId, 3, connection.password));
        responseTimer = setTimeout(() => finish(new Error('\u0052\u0043\u004f\u004e \u670d\u52a1\u5668\u672a\u54cd\u5e94\uff0c\u8bf7\u786e\u8ba4\u5df2\u542f\u7528\u0052\u0043\u004f\u004e')), 8000);
      });

      socket.on('data', (chunk) => {
        buffer = Buffer.concat([buffer, chunk]);
        while (buffer.length >= 4 && buffer.length >= buffer.readInt32LE(0) + 4) {
          const size = buffer.readInt32LE(0);
          if (size < 10 || size > 4 * 1024 * 1024) return finish(new Error('\u0052\u0043\u004f\u004e \u8fd4\u56de\u4e86\u65e0\u6548\u6570\u636e\uff0c\u8bf7\u68c0\u67e5\u7aef\u53e3'));
          const packet = buffer.subarray(4, size + 4);
          buffer = buffer.subarray(size + 4);
          const id = packet.readInt32LE(0);
          const body = packet.subarray(8, packet.length - 2).toString('utf8');

          if (!authenticated) {
            if (id === -1) return finish(new Error('\u0052\u0043\u004f\u004e \u5bc6\u7801\u9a8c\u8bc1\u5931\u8d25'));
            if (id === authId) {
              authenticated = true;
              clearTimeout(responseTimer);
              socket.write(this.packet(commandId, 2, normalizedCommand));
              responseTimer = setTimeout(() => finish(new Error('\u0052\u0043\u004f\u004e \u547d\u4ee4\u6267\u884c\u8d85\u65f6')), 8000);
            }
          } else if (id === commandId) {
            output += body;
            clearTimeout(responseTimer);
            responseTimer = setTimeout(() => finish(null, output || '\u547d\u4ee4\u5df2\u6267\u884c'), 150);
          }
        }
      });
      socket.once('error', (error) => finish(this.connectionError(error)));
      socket.once('end', () => {
        if (!settled) finish(new Error(authenticated ? '\u0052\u0043\u004f\u004e \u8fde\u63a5\u5df2\u65ad\u5f00' : '\u0052\u0043\u004f\u004e \u8fde\u63a5\u5728\u9a8c\u8bc1\u524d\u65ad\u5f00'));
      });
    });
  }

  connectionError(error) {
    const messages = {
      ECONNREFUSED: '\u0052\u0043\u004f\u004e \u7aef\u53e3\u62d2\u7edd\u8fde\u63a5\uff0c\u8bf7\u786e\u8ba4\u670d\u52a1\u5668\u5df2\u542f\u7528\u0052\u0043\u004f\u004e',
      EHOSTUNREACH: '\u65e0\u6cd5\u8bbf\u95ee\u0052\u0043\u004f\u004e \u4e3b\u673a',
      ENETUNREACH: '\u0052\u0043\u004f\u004e \u670d\u52a1\u5668\u6240\u5728\u7f51\u7edc\u4e0d\u53ef\u8fbe',
      ENOTFOUND: '\u65e0\u6cd5\u89e3\u6790\u0052\u0043\u004f\u004e \u4e3b\u673a\u5730\u5740'
    };
    return new Error(messages[error.code] || `RCON: ${error.message}`);
  }

  packet(id, type, body) {
    const content = Buffer.from(String(body), 'utf8');
    const packet = Buffer.alloc(content.length + 14);
    packet.writeInt32LE(content.length + 10, 0);
    packet.writeInt32LE(id, 4);
    packet.writeInt32LE(type, 8);
    content.copy(packet, 12);
    packet.writeInt16LE(0, packet.length - 2);
    return packet;
  }
}

module.exports = { RconClient };
