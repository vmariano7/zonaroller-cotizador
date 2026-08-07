// Servidor estático mínimo para probar la app en la compu.
// Uso: node servidor-local.js  →  http://localhost:4321
const http = require('http');
const fs = require('fs');
const path = require('path');

const RAIZ = __dirname;
const PUERTO = Number(process.env.PORT) || 4321;
const TIPOS = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
};

http
  .createServer((req, res) => {
    const limpia = decodeURIComponent(req.url.split('?')[0]);
    let destino = path.join(RAIZ, limpia === '/' ? 'index.html' : limpia);
    if (!destino.startsWith(RAIZ)) {
      res.writeHead(403).end('Prohibido');
      return;
    }
    fs.readFile(destino, (err, datos) => {
      if (err) {
        res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' }).end('No encontrado');
        return;
      }
      res.writeHead(200, {
        'Content-Type': TIPOS[path.extname(destino)] || 'application/octet-stream',
        'Cache-Control': 'no-store',
      });
      res.end(datos);
    });
  })
  .listen(PUERTO, () => console.log(`Cotizador en http://localhost:${PUERTO}`));
