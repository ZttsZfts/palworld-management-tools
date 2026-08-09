'use strict';

class RestClient {
  async request(connection, request = {}) {
    const method = String(request.method || 'GET').toUpperCase();
    const endpoint = String(request.endpoint || '/info');
    if (!endpoint.startsWith('/')) throw new Error('REST 路径必须以 / 开头');
    const protocol = connection.useHttps ? 'https' : 'http';
    const url = `${protocol}://${connection.host}:${connection.restPort}/v1/api${endpoint}`;
    const authorization = Buffer.from(`${connection.username}:${connection.password}`).toString('base64');
    const response = await fetch(url, {
      method,
      headers: {
        Authorization: `Basic ${authorization}`,
        Accept: 'application/json',
        'Content-Type': 'application/json'
      },
      body: request.body && method !== 'GET' ? JSON.stringify(request.body) : undefined,
      signal: AbortSignal.timeout(8000)
    });
    const text = await response.text();
    let data = text;
    try { data = text ? JSON.parse(text) : null; } catch {  }
    if (!response.ok) throw new Error(`REST ${response.status}: ${text || response.statusText}`);
    return { status: response.status, data };
  }
}

module.exports = { RestClient };
