import http from 'node:http';
import { readFile } from 'node:fs/promises';
const fixture = new URL('../tests/fixtures.html', import.meta.url);
http.createServer(async (_req, response) => {
  response.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
  response.end(await readFile(fixture));
}).listen(4173, '127.0.0.1', () => console.log('Capture test page: http://127.0.0.1:4173'));
