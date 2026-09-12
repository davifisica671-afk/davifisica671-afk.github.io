const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = 3000;
const SITE_DIR = __dirname;

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.mp4': 'video/mp4',
  '.webm': 'video/webm',
  '.m3u8': 'application/vnd.apple.mpegurl',
  '.mp3': 'audio/mpeg',
  '.wav': 'audio/wav',
  '.avif': 'image/avif',
  '.otf': 'font/otf',
};

function getMime(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  return MIME_TYPES[ext] || 'application/octet-stream';
}

const server = http.createServer((req, res) => {
  const parsedUrl = new URL(req.url, `http://${req.headers.host}`);
  let reqPath = decodeURIComponent(parsedUrl.pathname);
  if (reqPath === '/') reqPath = '/index.html';

  // Handle Next.js image optimization requests
  if (reqPath === '/_next/image') {
    const imageUrl = parsedUrl.searchParams.get('url');
    if (!imageUrl) {
      res.writeHead(400);
      res.end('Missing url parameter');
      return;
    }
    const imageFile = path.join(SITE_DIR, decodeURIComponent(imageUrl));
    if (!imageFile.startsWith(SITE_DIR)) {
      res.writeHead(403);
      res.end('Forbidden');
      return;
    }
    if (fs.existsSync(imageFile) && fs.statSync(imageFile).isFile()) {
      const data = fs.readFileSync(imageFile);
      res.writeHead(200, {
        'Content-Type': getMime(imageFile),
        'Cache-Control': 'public, max-age=300',
        'Access-Control-Allow-Origin': '*',
      });
      res.end(data);
    } else {
      console.log('404 (image):', imageUrl);
      res.writeHead(404);
      res.end('Image not found');
    }
    return;
  }

  const filePath = path.join(SITE_DIR, reqPath);

  // Security: prevent path traversal
  if (!filePath.startsWith(SITE_DIR)) {
    res.writeHead(403);
    res.end('Forbidden');
    return;
  }

  // Try exact file, then .html fallback
  let target = filePath;
  if (!fs.existsSync(target) || !fs.statSync(target).isFile()) {
    const withHtml = filePath + '.html';
    if (fs.existsSync(withHtml) && fs.statSync(withHtml).isFile()) {
      target = withHtml;
    }
  }

  if (fs.existsSync(target) && fs.statSync(target).isFile()) {
    const data = fs.readFileSync(target);
    const isHtml = target.endsWith('.html');
    res.writeHead(200, {
      'Content-Type': getMime(target),
      // dev-friendly: HTML sem cache; assets com cache curto (evita "nada mudou" no navegador)
      'Cache-Control': isHtml ? 'no-cache' : 'public, max-age=300',
      'Access-Control-Allow-Origin': '*',
    });
    res.end(data);
  } else {
    console.log('404:', reqPath);
    res.writeHead(404, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end('<h1>404 Not Found</h1><p>' + reqPath + '</p>');
  }
});

server.listen(PORT, () => {
  console.log('Refract mirror running at http://localhost:' + PORT);
  
  // Count files
  let count = 0;
  function walk(d) {
    fs.readdirSync(d, { withFileTypes: true }).forEach(e => {
      const f = path.join(d, e.name);
      if (e.isDirectory()) walk(f);
      else count++;
    });
  }
  walk(SITE_DIR);
  console.log('Serving', count, 'files from', SITE_DIR);
});
