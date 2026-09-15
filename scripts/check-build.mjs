import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';

const required = ['public/index.html', 'public/admin/index.html', 'public/app.js', 'public/admin/admin.js', 'public/styles.css', 'public/admin/admin.css', 'public/manifest.webmanifest', 'public/assets/brand/safemode-shop-dark.png', 'public/assets/brand/safemode-shop-light.png', 'vercel.json'];
for (const path of required) {
  if (!existsSync(path)) throw new Error(`Missing production file: ${path}`);
}
const config = JSON.parse(readFileSync('vercel.json', 'utf8'));
if (config.outputDirectory !== 'public') throw new Error('Vercel outputDirectory must be public');

const sources = ['api', 'lib', 'scripts', 'public'];
const jsFiles = ['server.mjs'];
for (const root of sources) {
  const walk = directory => {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      const path = join(directory, entry.name);
      if (entry.isDirectory()) walk(path);
      else if (/\.(?:js|mjs)$/.test(path)) jsFiles.push(path);
    }
  };
  walk(root);
}
for (const file of jsFiles) {
  const result = spawnSync(process.execPath, ['--check', file], { stdio: 'inherit' });
  if (result.status !== 0) throw new Error(`Syntax check failed: ${file}`);
}
console.log(`Static production assets and ${jsFiles.length} JavaScript files verified.`);
