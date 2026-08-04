'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const ejs = require('ejs');

function walk(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const target = path.join(directory, entry.name);
    return entry.isDirectory() ? walk(target) : [target];
  });
}

for (const file of [...walk('src'), ...walk('scripts')].filter((item) => item.endsWith('.js'))) {
  const result = spawnSync(process.execPath, ['--check', file], { stdio: 'inherit' });
  if (result.status !== 0) process.exit(result.status || 1);
}

ejs.renderFile('src/renderer/templates/app.ejs', {
  appName: 'Template check', asset: (value) => value,
  pages: [{ id: 'dashboard', icon: 'grid', label: '概览' }]
}).then(() => console.log('JavaScript syntax and EJS templates are valid.')).catch((error) => {
  console.error(error); process.exit(1);
});
