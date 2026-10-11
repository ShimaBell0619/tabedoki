import { existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
for (const path of ['index.html', 'tsconfig.json', 'src/main.tsx', 'src/food.ts', 'package-lock.json']) {
  if (!existsSync(path)) throw new Error(`必須ファイルがありません: ${path}`);
}
function scan(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap(entry => entry.isDirectory() ? scan(join(dir, entry.name)) : [join(dir, entry.name)]);
}
const files = [...scan('scripts'), ...scan('tests')];
if (existsSync('playwright.config.mjs')) files.push('playwright.config.mjs');
for (const file of files.filter(path => path.endsWith('.mjs'))) {
  const result = spawnSync(process.execPath, ['--check', file], { stdio: 'inherit' });
  if (result.status !== 0) process.exit(result.status || 1);
}
console.log('構成とJavaScript構文の検査に成功しました。');