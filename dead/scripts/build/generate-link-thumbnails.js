const fs = require('fs');
const http = require('http');
const path = require('path');
const { chromium } = require('playwright');

const repoRoot = path.resolve(__dirname, '..', '..', '..');
const outputDir = path.join(repoRoot, 'dead', 'images', 'link-thumbnails');
const manifestPath = path.join(repoRoot, 'dead', 'JSON', 'link-thumbnails.json');
const width = Number(process.env.LINK_THUMBNAIL_WIDTH || 1920);
const height = Number(process.env.LINK_THUMBNAIL_HEIGHT || 1080);
const quality = Number(process.env.LINK_THUMBNAIL_QUALITY || 86);
const settleMs = Number(process.env.LINK_THUMBNAIL_SETTLE_MS || 1200);
const concurrency = Number(process.env.LINK_THUMBNAIL_CONCURRENCY || 2);
const captureLimit = Number(process.env.LINK_THUMBNAIL_LIMIT || 0);

const ignoredDirectoryNames = new Set([
  '.git',
  '.github',
  '.vscode',
  '__pycache__',
  'node_modules'
]);

const ignoredRelativePrefixes = [
  'dead/images/link-thumbnails/'
];

function toRelativeWebPath(filePath) {
  return path.relative(repoRoot, filePath).split(path.sep).join('/');
}

function toUrlPath(relativePath) {
  if (relativePath === 'index.html') return '/';
  if (relativePath.endsWith('/index.html')) {
    return `/${relativePath.slice(0, -'index.html'.length)}`;
  }
  return `/${relativePath}`;
}

function toSlug(relativePath) {
  const withoutIndex = relativePath === 'index.html'
    ? 'home'
    : relativePath.replace(/\/index\.html$/i, '').replace(/\.html$/i, '');

  return withoutIndex
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'page';
}

function walkHtmlFiles(directory) {
  const entries = fs.readdirSync(directory, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const fullPath = path.join(directory, entry.name);

    if (entry.isDirectory()) {
      if (!ignoredDirectoryNames.has(entry.name)) {
        files.push(...walkHtmlFiles(fullPath));
      }
      continue;
    }

    if (!entry.isFile() || !entry.name.toLowerCase().endsWith('.html')) {
      continue;
    }

    const relativePath = toRelativeWebPath(fullPath);
    if (ignoredRelativePrefixes.some((prefix) => relativePath.startsWith(prefix))) {
      continue;
    }

    files.push(fullPath);
  }

  return files;
}

function discoverPages() {
  const usedSlugs = new Map();

  return walkHtmlFiles(repoRoot)
    .map((filePath) => {
      const sourcePath = toRelativeWebPath(filePath);
      const baseSlug = toSlug(sourcePath);
      const slugCount = usedSlugs.get(baseSlug) || 0;
      usedSlugs.set(baseSlug, slugCount + 1);
      const slug = slugCount ? `${baseSlug}-${slugCount + 1}` : baseSlug;

      return {
        slug,
        sourcePath,
        urlPath: toUrlPath(sourcePath),
        thumbnail: `/dead/images/link-thumbnails/${slug}.jpg`
      };
    })
    .sort((a, b) => {
      if (a.urlPath === '/') return -1;
      if (b.urlPath === '/') return 1;
      return a.urlPath.localeCompare(b.urlPath);
    });
}

function getContentType(filePath) {
  const extension = path.extname(filePath).toLowerCase();
  const types = {
    '.css': 'text/css; charset=utf-8',
    '.csv': 'text/csv; charset=utf-8',
    '.gif': 'image/gif',
    '.html': 'text/html; charset=utf-8',
    '.ico': 'image/x-icon',
    '.jpeg': 'image/jpeg',
    '.jpg': 'image/jpeg',
    '.js': 'text/javascript; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.md': 'text/markdown; charset=utf-8',
    '.mp3': 'audio/mpeg',
    '.mp4': 'video/mp4',
    '.pdf': 'application/pdf',
    '.png': 'image/png',
    '.svg': 'image/svg+xml; charset=utf-8',
    '.webp': 'image/webp',
    '.xml': 'application/xml; charset=utf-8',
    '.zip': 'application/zip'
  };

  return types[extension] || 'application/octet-stream';
}

function resolveRequestPath(url) {
  const parsedUrl = new URL(url, 'http://localhost');
  const decodedPath = decodeURIComponent(parsedUrl.pathname);
  const relativePath = decodedPath === '/'
    ? 'index.html'
    : decodedPath.replace(/^\/+/, '');
  let filePath = path.resolve(repoRoot, relativePath);

  const rootRelativePath = path.relative(repoRoot, filePath);
  if (rootRelativePath.startsWith('..') || path.isAbsolute(rootRelativePath)) {
    return null;
  }

  if (fs.existsSync(filePath) && fs.statSync(filePath).isDirectory()) {
    filePath = path.join(filePath, 'index.html');
  }

  return filePath;
}

function startServer() {
  const server = http.createServer((request, response) => {
    const filePath = resolveRequestPath(request.url || '/');

    if (!filePath || !fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) {
      response.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      response.end('Not found');
      return;
    }

    response.writeHead(200, {
      'Content-Type': getContentType(filePath),
      'Cache-Control': 'no-store'
    });
    fs.createReadStream(filePath).pipe(response);
  });

  return new Promise((resolve, reject) => {
    server.on('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      resolve({
        origin: `http://127.0.0.1:${address.port}`,
        close: () => new Promise((closeResolve) => server.close(closeResolve))
      });
    });
  });
}

async function capturePage(browser, origin, pageInfo) {
  const page = await browser.newPage({
    viewport: { width, height },
    deviceScaleFactor: 1
  });
  const url = `${origin}${pageInfo.urlPath}`;
  const outputPath = path.join(outputDir, `${pageInfo.slug}.jpg`);

  page.on('dialog', (dialog) => dialog.dismiss().catch(() => {}));

  try {
    await page.goto(url, { waitUntil: 'load', timeout: 45000 });
    await page.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => {});
    await page.waitForTimeout(settleMs);
    await page.screenshot({
      path: outputPath,
      type: 'jpeg',
      quality,
      fullPage: false
    });

    const bytes = fs.statSync(outputPath).size;
    return {
      ...pageInfo,
      url: pageInfo.urlPath,
      bytes,
      status: 'captured'
    };
  } catch (error) {
    return {
      ...pageInfo,
      url: pageInfo.urlPath,
      bytes: 0,
      status: 'failed',
      error: error.message
    };
  } finally {
    await page.close().catch(() => {});
  }
}

async function runPool(items, workerCount, worker) {
  const results = new Array(items.length);
  let nextIndex = 0;

  async function runWorker() {
    while (nextIndex < items.length) {
      const index = nextIndex;
      nextIndex += 1;
      results[index] = await worker(items[index], index);
    }
  }

  await Promise.all(
    Array.from({ length: Math.max(1, workerCount) }, () => runWorker())
  );

  return results;
}

async function main() {
  const discoveredPages = discoverPages();
  const pages = captureLimit > 0 ? discoveredPages.slice(0, captureLimit) : discoveredPages;

  fs.mkdirSync(outputDir, { recursive: true });
  fs.rmSync(outputDir, { recursive: true, force: true });
  fs.mkdirSync(outputDir, { recursive: true });

  const server = await startServer();
  const browser = await chromium.launch();

  try {
    console.log(`Capturing ${pages.length} page thumbnails at ${width}x${height}.`);
    const thumbnails = await runPool(pages, concurrency, async (pageInfo, index) => {
      const result = await capturePage(browser, server.origin, pageInfo);
      const status = result.status === 'captured' ? 'OK' : 'FAIL';
      console.log(`[${index + 1}/${pages.length}] ${status} ${pageInfo.urlPath}`);
      return result;
    });

    const captured = thumbnails.filter((entry) => entry.status === 'captured').length;
    const missing = thumbnails.length - captured;
    const manifest = {
      generatedAt: new Date().toISOString(),
      viewport: { width, height },
      format: 'jpg',
      quality,
      source: 'all repo HTML pages captured via Playwright viewport screenshots',
      count: thumbnails.length,
      captured,
      missing,
      thumbnails
    };

    fs.mkdirSync(path.dirname(manifestPath), { recursive: true });
    fs.writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');

    console.log(`Wrote ${path.relative(repoRoot, manifestPath)} with ${captured}/${thumbnails.length} captures.`);
    if (missing > 0) {
      process.exitCode = 1;
    }
  } finally {
    await browser.close().catch(() => {});
    await server.close();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
