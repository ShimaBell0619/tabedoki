import { spawnSync } from 'node:child_process';
const result = spawnSync(process.execPath, ['node_modules/vite/bin/vite.js', 'build'], {
  stdio: 'inherit', env: { ...process.env, VITE_SUPABASE_URL: 'https://cloud.tabedoki.test', VITE_SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_test' },
});
process.exit(result.status ?? 1);
