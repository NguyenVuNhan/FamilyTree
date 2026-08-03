// tests/e2e/fixture-server.mjs
// Serves tests/e2e/fixtures over real HTTP for the e2e cases that must exercise
// a genuine cross-origin fetch: page.route() fulfillment silently bypasses CORS,
// which would mask a missing-CORS bug, and can't prove the http-localhost carve-out.
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { basename, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), 'fixtures');

createServer(async (req, res) => {
  try {
    const name = basename(decodeURIComponent(new URL(req.url, 'http://localhost').pathname));
    const body = await readFile(join(root, name));
    res.writeHead(200, { 'Content-Type': 'text/csv', 'Access-Control-Allow-Origin': '*' });
    res.end(body);
  } catch {
    res.writeHead(404, { 'Access-Control-Allow-Origin': '*' });
    res.end('not found');
  }
}).listen(8787, () => console.log('fixture server on http://localhost:8787'));
