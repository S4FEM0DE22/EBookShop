import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';

const files = ['.env', '.env.local'].filter(existsSync);
if (!files.length) {
  console.error('Create .env or .env.local before starting the Supabase version.');
  process.exit(1);
}

const child = spawn(process.execPath, [...files.map(file => `--env-file=${file}`), 'server.mjs'], {
  stdio: 'inherit',
  env: process.env
});

child.on('error', error => {
  console.error('Could not start the shop:', error.message);
  process.exitCode = 1;
});
child.on('exit', (code, signal) => {
  process.exitCode = signal ? 130 : code ?? 1;
});
