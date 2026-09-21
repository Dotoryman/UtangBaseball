import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const auth = await readFile('lib/admin-auth.ts', 'utf8');
const page = await readFile('app/admin/page.tsx', 'utf8');

test('admin session cookie is mobile-compatible while remaining secure', () => {
  assert.match(auth, /HttpOnly; Secure; SameSite=Lax/);
  assert.doesNotMatch(auth, /SameSite=Strict/);
});

test('admin requests include credentials and expired sessions return to login', () => {
  assert.match(page, /credentials: 'include'/);
  assert.match(page, /class AdminApiError extends Error/);
  assert.match(page, /setAuthenticated\(false\)/);
  assert.match(page, /인증이 만료됐어\. 다시 로그인해줘\./);
  assert.match(page, /const session = await api<\{ authenticated: boolean \}>\('\/api\/admin\/auth'\)/);
});
