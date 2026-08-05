'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const { MovementPathRepository } = require('../src/main/modules/movement-path-repository.module');

async function main() {
  const root = path.resolve('.movement-path-test-data');
  await fs.rm(root, { recursive: true, force: true });
  const repository = new MovementPathRepository({ getPath: () => root });
  const now = Date.now();

  await repository.record('server', [{
    uid: 'old-player-id', userId: '', steam64: '', name: 'Test Player',
    online: true, hasLocation: true, x: 10, y: 20
  }], now - 2000);
  await repository.record('server', [{
    uid: 'new-player-id', userId: 'steam_76561198000000001', steam64: '76561198000000001', name: 'Test Player',
    online: true, hasLocation: true, x: 30, y: 40
  }], now - 1000);

  const result = await repository.getPaths('server', {
    since: now - 10000,
    playerIds: ['new-player-id'],
    players: [{ uid: 'new-player-id', userId: 'steam_76561198000000001', steam64: '76561198000000001', name: 'Test Player' }]
  });
  assert.equal(result.paths.length, 1);
  assert.equal(result.paths[0].uid, 'newplayerid');
  assert.deepEqual(result.paths[0].points.map((point) => [point.x, point.y]), [[10, 20], [30, 40]]);

  const ambiguous = repository.identities([
    { uid: 'one', name: 'Same Name' },
    { uid: 'two', name: 'Same Name' }
  ]);
  assert.equal(ambiguous.has('name:same name'), false);
  await fs.rm(root, { recursive: true, force: true });
  console.log('Movement identity reconciliation tests passed.');
}

main().catch((error) => { console.error(error); process.exit(1); });
