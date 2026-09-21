import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const proxy = await readFile('proxy.ts', 'utf8');

test('public traffic is canonicalized to secure apex domain', () => {
  assert.match(proxy, /url\.protocol !== 'https:'/);
  assert.match(proxy, /forwardedProtocol === 'http'/);
  assert.match(proxy, /url\.hostname = PRIMARY_HOST/);
  assert.match(proxy, /NextResponse\.redirect\(url, 308\)/);
  assert.match(proxy, /matcher: '\/:path\*'/);
});
