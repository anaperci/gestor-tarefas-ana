import { defineConfig } from '@playwright/test';
export default defineConfig({
 testDir:'./tests',testMatch:'**/*.spec.ts',timeout:30000,retries:0,workers:2,
 use:{baseURL:'http://127.0.0.1:3017',headless:true,channel:'chrome',screenshot:'only-on-failure',trace:'retain-on-failure'},
 webServer:{command:'npm run start -- --hostname 127.0.0.1 --port 3017',url:'http://127.0.0.1:3017',reuseExistingServer:false,timeout:60000},
});
