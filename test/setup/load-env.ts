import { existsSync } from 'node:fs';

// Loads .env.test without overriding variables that are already set (CI sets its own).
if (existsSync('.env.test')) process.loadEnvFile('.env.test');
