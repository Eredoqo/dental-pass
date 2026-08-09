import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

// Load the repo-root .env (DATABASE_URL etc.) without overriding anything
// already set in the environment.
try {
  const raw = readFileSync(resolve(__dirname, '../../../.env'), 'utf8');
  for (const line of raw.split('\n')) {
    const match = /^([A-Z0-9_]+)="?([^"]*)"?\s*$/.exec(line.trim());
    if (match && process.env[match[1]] === undefined) {
      process.env[match[1]] = match[2];
    }
  }
} catch {
  // no .env — rely on the ambient environment (CI)
}

// The e2e suite mints its own HS256 tokens: the verifier prefers
// SUPABASE_JWT_SECRET when set, so tests can create arbitrary users/roles
// without touching Supabase Auth. This env var only lives inside the test run.
process.env.SUPABASE_JWT_SECRET = 'e2e-test-secret-not-used-anywhere-else';
