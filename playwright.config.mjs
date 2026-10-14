import { defineConfig } from '@playwright/test';
export default defineConfig({
 testDir:'./tests/e2e',timeout:30000,expect:{timeout:5000},retries:0,workers:1,
 reporter:[['list'],['html',{open:'never'}]],outputDir:'test-results',
 use:{browserName:'chromium',baseURL:'http://127.0.0.1:4173',screenshot:'only-on-failure',trace:'retain-on-failure'},
 webServer:{command:'node scripts/build-e2e.mjs && npm run preview -- --port 4173 --strictPort',url:'http://127.0.0.1:4173',reuseExistingServer:!process.env.CI,timeout:30000}
});