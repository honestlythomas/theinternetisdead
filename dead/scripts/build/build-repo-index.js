const fs = require('fs');
const path = require('path');

const repoRoot = path.resolve(__dirname, '..', '..', '..');
const outputPath = path.join(repoRoot, 'dead', 'JSON', 'repo-index.json');
const ignoredDirectoryNames = new Set([
  '.git',
  '.github',
  '.vscode',
  '__pycache__',
  'node_modules'
]);

function toWebPath(filePath) {
  const relativePath = path.relative(repoRoot, filePath).split(path.sep).join('/');
  return `/${relativePath}`;
}

function toDirectoryWebPath(filePath) {
  if (filePath === repoRoot) return '/';
  return `${toWebPath(filePath)}/`;
}

function shouldIgnoreEntry(entry) {
  return ignoredDirectoryNames.has(entry.name) || entry.name.startsWith('.');
}

function walkDirectories(directory) {
  const entries = fs.readdirSync(directory, { withFileTypes: true });
  const folders = [];

  for (const entry of entries) {
    if (!entry.isDirectory() || shouldIgnoreEntry(entry)) {
      continue;
    }

    const fullPath = path.join(directory, entry.name);
    folders.push(fullPath, ...walkDirectories(fullPath));
  }

  return folders;
}

function walkItems(directory) {
  const entries = fs.readdirSync(directory, { withFileTypes: true });
  const items = [];

  for (const entry of entries) {
    if (shouldIgnoreEntry(entry)) {
      continue;
    }

    const fullPath = path.join(directory, entry.name);
    const stats = fs.statSync(fullPath);
    const parentDirectory = path.dirname(fullPath);
    const parent = parentDirectory === repoRoot ? '.' : toWebPath(parentDirectory);

    if (entry.isDirectory()) {
      items.push({
        type: 'directory',
        path: toDirectoryWebPath(fullPath),
        href: toDirectoryWebPath(fullPath),
        name: entry.name,
        parent
      });
      items.push(...walkItems(fullPath));
      continue;
    }

    if (entry.isFile()) {
      items.push({
        type: 'file',
        path: toWebPath(fullPath),
        href: toWebPath(fullPath),
        name: entry.name,
        parent,
        size: stats.size
      });
    }
  }

  return items;
}

function readExistingIndex() {
  try {
    return JSON.parse(fs.readFileSync(outputPath, 'utf8'));
  } catch (error) {
    return null;
  }
}

function arraysEqual(left, right) {
  return Array.isArray(left)
    && Array.isArray(right)
    && left.length === right.length
    && left.every((value, index) => value === right[index]);
}

const folders = ['/', ...walkDirectories(repoRoot).map(toDirectoryWebPath)]
  .sort((a, b) => {
    if (a === '/') return -1;
    if (b === '/') return 1;
    return a.localeCompare(b);
  });
const rootItem = {
  type: 'directory',
  path: '/',
  href: '/',
  name: 'Root',
  parent: '.'
};
const items = [rootItem, ...walkItems(repoRoot)]
  .sort((a, b) => {
    if (a.path === '/') return -1;
    if (b.path === '/') return 1;
    return a.path.localeCompare(b.path);
  });

const existingIndex = readExistingIndex();
if (
  arraysEqual(existingIndex && existingIndex.folders, folders) &&
  JSON.stringify(existingIndex && existingIndex.items) === JSON.stringify(items)
) {
  console.log(`No repo index changes for ${path.relative(repoRoot, outputPath)}.`);
  process.exit(0);
}

const index = {
  generatedAt: new Date().toISOString(),
  folders,
  items
};

fs.mkdirSync(path.dirname(outputPath), { recursive: true });
fs.writeFileSync(outputPath, `${JSON.stringify(index, null, 2)}\n`, 'utf8');

console.log(`Wrote ${path.relative(repoRoot, outputPath)} with ${folders.length} folders and ${items.length} items.`);
