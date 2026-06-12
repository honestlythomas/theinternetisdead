const fs = require('fs');
const path = require('path');

const repoRoot = path.resolve(__dirname, '..', '..', '..');
const navPath = path.join(repoRoot, 'dead', 'stuff', 'nav', 'nav.html');
const manifestPath = path.join(repoRoot, 'dead', 'JSON', 'link-thumbnails.json');

const carouselConfigs = [
  {
    name: 'browser games',
    directory: path.join(repoRoot, 'dead', 'games'),
    urlPrefix: '/dead/games',
    startMarker: '        // BEGIN generated browser games carousel links',
    endMarker: '        // END generated browser games carousel links'
  },
  {
    name: 'web experiments',
    directory: path.join(repoRoot, 'dead', 'experiments'),
    urlPrefix: '/dead/experiments',
    startMarker: '        // BEGIN generated web experiments carousel links',
    endMarker: '        // END generated web experiments carousel links'
  },
  {
    name: 'web tools',
    directory: path.join(repoRoot, 'dead', 'tools'),
    urlPrefix: '/dead/tools',
    startMarker: '        // BEGIN generated web tools carousel links',
    endMarker: '        // END generated web tools carousel links'
  }
];

function titleFromFolderName(folderName) {
  return folderName
    .split('-')
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

function readThumbnailMap() {
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  const map = new Map();

  for (const entry of manifest.thumbnails || []) {
    if (entry && entry.urlPath && entry.thumbnail) {
      map.set(entry.urlPath, entry.thumbnail);
    }
  }

  return map;
}

function getDirectFolders(directory) {
  return fs.readdirSync(directory, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .filter((folderName) => fs.existsSync(path.join(directory, folderName, 'index.html')))
    .sort((a, b) => a.localeCompare(b));
}

function buildCarouselLinks(config, thumbnailMap) {
  const lines = [];
  const missingThumbnails = [];

  for (const folderName of getDirectFolders(config.directory)) {
    const href = `${config.urlPrefix}/${folderName}/`;
    const thumbnail = thumbnailMap.get(href);

    if (!thumbnail) {
      missingThumbnails.push(href);
      continue;
    }

    const text = titleFromFolderName(folderName);
    lines.push(`        { text: '${text}', href: '${href}', frameSrc: '${href}', thumbnail: '${thumbnail}' },`);
  }

  if (missingThumbnails.length) {
    console.warn(`Skipped ${missingThumbnails.length} ${config.name} folders without thumbnails:`);
    missingThumbnails.forEach((href) => console.warn(`- ${href}`));
  }

  return lines;
}

function replaceGeneratedBlock(source, config, generatedLines) {
  const startIndex = source.indexOf(config.startMarker);
  const endIndex = source.indexOf(config.endMarker);

  if (startIndex === -1 || endIndex === -1 || endIndex < startIndex) {
    throw new Error(`Could not find generated ${config.name} carousel markers in nav.html.`);
  }

  const before = source.slice(0, startIndex + config.startMarker.length);
  const after = source.slice(endIndex);
  return `${before}\n${generatedLines.join('\n')}\n${after}`;
}

const thumbnailMap = readThumbnailMap();
const source = fs.readFileSync(navPath, 'utf8');
let nextSource = source;
const results = [];

for (const config of carouselConfigs) {
  const generatedLines = buildCarouselLinks(config, thumbnailMap);
  nextSource = replaceGeneratedBlock(nextSource, config, generatedLines);
  results.push(`${generatedLines.length} ${config.name}`);
}

if (nextSource === source) {
  console.log('No nav carousel changes.');
  process.exit(0);
}

fs.writeFileSync(navPath, nextSource, 'utf8');
console.log(`Updated ${path.relative(repoRoot, navPath)} with ${results.join(' and ')} carousel links.`);
