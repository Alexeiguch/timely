import { defineConfig } from '@playwright/test';
export default defineConfig({testDir:'./tests/web',fullyParallel:false,workers:1,use:{baseURL:process.env.TEST_BASE_URL ?? 'http://localhost:3000',channel:'chrome',trace:'off',screenshot:'off',video:'off'},projects:[{name:'desktop',use:{viewport:{width:1280,height:800}}},{name:'phone',use:{viewport:{width:320,height:740}}}]});
