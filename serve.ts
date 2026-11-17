// Emberlight — a tiny static file server for local play-testing.
//
// Serves the game/ directory next to this file on http://localhost:8080, so
// the game can be opened in a desktop browser exactly as the bounty will
// load it: plain files, no bundler, no network.
//
//   node serve.ts
//   # then open http://localhost:8080/ in a browser
//
// Node standard library only; stop it with Ctrl-C.

import { createServer } from 'node:http';
import { createReadStream, existsSync, statSync } from 'node:fs';
import { dirname, extname, join, normalize, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const PORT = 8080;
const GAME_DIR = join(dirname(fileURLToPath(import.meta.url)), 'game');

// The content types the game actually needs. Anything else falls back to a
// generic binary download rather than being guessed at.
const MIME_TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.webp': 'image/webp',
  '.wav': 'audio/wav',
  '.mp3': 'audio/mpeg',
  '.ogg': 'audio/ogg',
  '.wasm': 'application/wasm',
  '.ico': 'image/x-icon',
};

const server = createServer((req, res) => {
  // Only GET and HEAD make sense for a read-only file server.
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    res.writeHead(405, { 'content-type': 'text/plain; charset=utf-8' });
    res.end('Method not allowed\n');
    return;
  }

  // Decode the path, drop any query string, and refuse anything that would
  // climb out of game/ (a request for /../LICENSE must never reach it).
  let urlPath: string;
  try {
    urlPath = decodeURIComponent(new URL(req.url ?? '/', 'http://localhost').pathname);
  } catch {
    res.writeHead(400, { 'content-type': 'text/plain; charset=utf-8' });
    res.end('Bad request\n');
    return;
  }
  const filePath = resolve(join(GAME_DIR, normalize(urlPath).replace(/^(\.\.[/\\])+/, '')));
  if (filePath !== GAME_DIR && !filePath.startsWith(GAME_DIR + sep)) {
    res.writeHead(403, { 'content-type': 'text/plain; charset=utf-8' });
    res.end('Forbidden\n');
    return;
  }

  // A directory request serves its index.html, as a browser expects.
  let target = filePath;
  if (existsSync(target) && statSync(target).isDirectory()) {
    target = join(target, 'index.html');
  }

  if (!existsSync(target) || !statSync(target).isFile()) {
    res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' });
    res.end('Not found\n');
    return;
  }

  const type = MIME_TYPES[extname(target).toLowerCase()] ?? 'application/octet-stream';
  res.writeHead(200, { 'content-type': type, 'cache-control': 'no-store' });
  if (req.method === 'HEAD') {
    res.end();
    return;
  }
  createReadStream(target).pipe(res);
});

server.listen(PORT, () => {
  console.log(`Emberlight play-test server: http://localhost:${PORT}/ (serving game/)`);
});
