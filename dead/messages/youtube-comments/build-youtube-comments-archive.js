#!/usr/bin/env node

const fs = require("fs");
const path = require("path");

const defaultInputDir = __dirname;
const inputDir = process.argv[2] ? path.resolve(process.argv[2]) : defaultInputDir;
const outputPath = process.argv[3]
  ? path.resolve(process.argv[3])
  : path.join(__dirname, "index.html");

const fieldVariants = {
  date: [
    "Comment Create Timestamp",
    "Comment Timestamp",
    "Create Timestamp",
    "Created At",
    "Date",
    "Timestamp",
    "Time",
  ],
  comment: ["Comment Text", "Text", "Comment", "Body", "Message"],
  videoId: ["Video ID", "Video Id", "VideoID", "Video"],
  videoUrl: ["Video URL", "Video Url", "Video Link", "URL", "Url", "Link"],
  postId: ["Post ID", "Post Id", "PostID"],
  commentId: ["Comment ID", "Comment Id", "CommentID"],
  parentCommentId: ["Parent Comment ID", "Parent Comment Id", "ParentCommentID"],
  topLevelCommentId: ["Top-Level Comment ID", "Top Level Comment ID", "TopLevelCommentID"],
};

function parseCsv(text) {
  const rows = [];
  let row = [];
  let cell = "";
  let inQuotes = false;

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    const next = text[index + 1];

    if (inQuotes) {
      if (char === '"' && next === '"') {
        cell += '"';
        index += 1;
      } else if (char === '"') {
        inQuotes = false;
      } else {
        cell += char;
      }
      continue;
    }

    if (char === '"') {
      inQuotes = true;
    } else if (char === ",") {
      row.push(cell);
      cell = "";
    } else if (char === "\n") {
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
    } else if (char !== "\r") {
      cell += char;
    }
  }

  if (cell.length > 0 || row.length > 0) {
    row.push(cell);
    rows.push(row);
  }

  return rows.filter((csvRow) => csvRow.some((value) => value.trim() !== ""));
}

function normalizeHeader(value) {
  return String(value || "")
    .replace(/^\uFEFF/, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "");
}

function makeRowObject(headers, values) {
  const row = {};
  headers.forEach((header, index) => {
    row[header] = values[index] || "";
  });
  return row;
}

function pickField(row, variants) {
  const wanted = new Set(variants.map(normalizeHeader));
  for (const [key, value] of Object.entries(row)) {
    if (wanted.has(normalizeHeader(key)) && String(value || "").trim() !== "") {
      return value;
    }
  }
  return "";
}

function extractCommentText(rawValue) {
  const raw = String(rawValue || "");
  if (!raw.trim()) {
    return "";
  }

  const trimmed = raw.trim();
  if (trimmed.includes('"text"')) {
    try {
      const fragments = JSON.parse(`[${trimmed}]`);
      return fragments
        .map((fragment) => {
          if (fragment && Object.prototype.hasOwnProperty.call(fragment, "text")) {
            return String(fragment.text);
          }
          return "";
        })
        .join("");
    } catch (error) {
      const matches = [...trimmed.matchAll(/"text"\s*:\s*"((?:\\.|[^"\\])*)"/g)];
      if (matches.length > 0) {
        return matches
          .map((match) => JSON.parse(`"${match[1]}"`))
          .join("");
      }
    }
  }

  return raw;
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function escapeAttribute(value) {
  return escapeHtml(value).replace(/`/g, "&#96;");
}

function sortCsvFiles(files) {
  return files.sort((left, right) => left.localeCompare(right, undefined, { numeric: true }));
}

function getVideoLink(videoId, videoUrl) {
  if (videoUrl) {
    return videoUrl;
  }
  const cleanVideoId = String(videoId || "").trim();
  if (cleanVideoId) {
    return `https://www.youtube.com/watch?v=${encodeURIComponent(cleanVideoId)}`;
  }
  return "";
}

function getEmbedLink(videoId) {
  const cleanVideoId = String(videoId || "").trim();
  if (!cleanVideoId) {
    return "";
  }
  return `https://www.youtube.com/embed/${encodeURIComponent(cleanVideoId)}`;
}

function buildEntries() {
  if (!fs.existsSync(inputDir)) {
    throw new Error(`Input directory does not exist: ${inputDir}`);
  }

  const csvFiles = sortCsvFiles(
    fs.readdirSync(inputDir).filter((fileName) => fileName.toLowerCase().endsWith(".csv"))
  );
  const entries = [];
  let totalRows = 0;
  let skippedRows = 0;

  for (const fileName of csvFiles) {
    const filePath = path.join(inputDir, fileName);
    const rows = parseCsv(fs.readFileSync(filePath, "utf8"));
    if (rows.length < 2) {
      continue;
    }

    const headers = rows[0].map((header) => header.replace(/^\uFEFF/, ""));
    for (const values of rows.slice(1)) {
      totalRows += 1;
      const row = makeRowObject(headers, values);
      const rawDate = pickField(row, fieldVariants.date);
      const rawComment = pickField(row, fieldVariants.comment);
      const commentText = extractCommentText(rawComment);
      const timestamp = Date.parse(rawDate);

      if (!rawDate || Number.isNaN(timestamp) || !commentText) {
        skippedRows += 1;
        continue;
      }

      const videoId = pickField(row, fieldVariants.videoId);
      const videoUrl = pickField(row, fieldVariants.videoUrl);

      entries.push({
        date: rawDate,
        timestamp,
        commentText,
        sourceFile: fileName,
        videoId,
        videoLink: getVideoLink(videoId, videoUrl),
        postId: pickField(row, fieldVariants.postId),
        commentId: pickField(row, fieldVariants.commentId),
        parentCommentId: pickField(row, fieldVariants.parentCommentId),
        topLevelCommentId: pickField(row, fieldVariants.topLevelCommentId),
      });
    }
  }

  const dedupedEntries = [];
  const seen = new Set();
  for (const entry of entries) {
    const key = `${entry.date}\u0000${entry.commentText}`;
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    dedupedEntries.push(entry);
  }

  dedupedEntries.sort((left, right) => {
    if (left.timestamp !== right.timestamp) {
      return left.timestamp - right.timestamp;
    }
    return left.commentText.localeCompare(right.commentText);
  });

  return {
    csvFiles,
    totalRows,
    skippedRows,
    duplicatesRemoved: entries.length - dedupedEntries.length,
    entries: dedupedEntries,
  };
}

function renderMetaItem(label, value, href) {
  if (!value) {
    return "";
  }

  const renderedValue = href
    ? `<a href="${escapeAttribute(href)}">${escapeHtml(value)}</a>`
    : escapeHtml(value);

  return `
            <div class="meta-item">
              <dt>${escapeHtml(label)}</dt>
              <dd>${renderedValue}</dd>
            </div>`;
}

function buildHtml({ csvFiles, totalRows, skippedRows, duplicatesRemoved, entries }) {
  const generatedAt = new Date().toISOString();
  const renderedEntries = entries
    .map((entry, index) => {
      const displayDate = escapeHtml(entry.date);
      const machineDate = escapeAttribute(new Date(entry.timestamp).toISOString());
      const videoValue = entry.videoId || entry.videoLink;
      const embedLink = getEmbedLink(entry.videoId);
      const searchText = [
        entry.date,
        entry.commentText,
        entry.videoId,
        entry.videoLink,
        embedLink,
        entry.sourceFile,
        entry.commentId,
        entry.postId,
        entry.parentCommentId,
        entry.topLevelCommentId,
      ].join(" ");
      const metaItems = [
        renderMetaItem("video", videoValue, entry.videoLink),
        renderMetaItem("embed", embedLink, embedLink),
        renderMetaItem("source", entry.sourceFile),
        renderMetaItem("comment id", entry.commentId),
        renderMetaItem("post id", entry.postId),
        renderMetaItem("parent", entry.parentCommentId),
        renderMetaItem("thread", entry.topLevelCommentId),
      ].join("");

      return `
        <article class="comment-entry" id="comment-${index + 1}" data-search="${escapeAttribute(searchText.toLowerCase())}">
          <div class="detail-view">
            <header class="comment-header">
              <a class="entry-number" href="#comment-${index + 1}" aria-label="Permalink to comment ${index + 1}">#${index + 1}</a>
              <time datetime="${machineDate}">${displayDate}</time>
            </header>
            <pre class="comment-text">${escapeHtml(entry.commentText)}</pre>
            <dl class="meta-grid">${metaItems}
            </dl>
          </div>
          <div class="simple-view">
            <time class="simple-date" datetime="${machineDate}">${displayDate}</time>
            <pre class="simple-comment">${escapeHtml(entry.commentText)}</pre>
            ${embedLink ? `<iframe class="simple-embed" src="${escapeAttribute(embedLink)}" title="YouTube video for comment ${index + 1}" loading="lazy" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowfullscreen></iframe>` : `<span class="simple-embed-missing">no video id</span>`}
          </div>
        </article>`;
    })
    .join("\n");

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>YouTube Comments Archive</title>
  <meta name="description" content="Recovered Google Takeout YouTube comments sorted oldest first.">
  <style>
    :root {
      color-scheme: dark;
      --bg: #020403;
      --panel: #07100b;
      --panel-2: #0b1710;
      --line: #214b34;
      --line-dim: #14301f;
      --text: #d8ffe2;
      --muted: #8fbd9a;
      --accent: #58ff87;
      --amber: #ffd166;
      --danger: #ff6b6b;
      --shadow: rgba(88, 255, 135, 0.14);
    }

    * {
      box-sizing: border-box;
    }

    html {
      background: var(--bg);
      color: var(--text);
      font-family: "Courier New", Courier, monospace;
      line-height: 1.5;
    }

    body {
      min-height: 100vh;
      margin: 0;
      background:
        linear-gradient(rgba(88, 255, 135, 0.035) 50%, transparent 50%) 0 0 / 100% 4px,
        radial-gradient(circle at 50% 0%, rgba(88, 255, 135, 0.11), transparent 42rem),
        var(--bg);
    }

    body::before {
      position: fixed;
      inset: 0;
      pointer-events: none;
      content: "";
      background: linear-gradient(90deg, rgba(255, 0, 0, 0.03), rgba(0, 255, 135, 0.02), rgba(0, 60, 255, 0.03));
      mix-blend-mode: screen;
    }

    a {
      color: var(--accent);
      text-decoration: none;
    }

    a:hover,
    a:focus {
      color: var(--amber);
      text-decoration: underline;
    }

    .archive-shell {
      width: min(1180px, calc(100% - 32px));
      margin: 0 auto;
      padding: 40px 0 64px;
    }

    .archive-header {
      padding: 24px;
      border: 1px solid var(--line);
      background: linear-gradient(180deg, rgba(7, 16, 11, 0.94), rgba(2, 4, 3, 0.92));
      box-shadow: 0 0 32px var(--shadow);
    }

    .kicker {
      margin: 0 0 12px;
      color: var(--amber);
      font-size: 0.78rem;
      letter-spacing: 0;
      text-transform: uppercase;
    }

    h1 {
      margin: 0;
      color: var(--accent);
      font-size: clamp(2rem, 6vw, 4rem);
      line-height: 1;
      text-shadow: 0 0 16px var(--shadow);
    }

    .subtitle {
      max-width: 760px;
      margin: 14px 0 0;
      color: var(--muted);
      font-size: 1rem;
    }

    .stats {
      display: grid;
      grid-template-columns: repeat(5, minmax(0, 1fr));
      gap: 1px;
      margin: 18px 0 0;
      border: 1px solid var(--line-dim);
      background: var(--line-dim);
    }

    .stat {
      min-width: 0;
      padding: 12px;
      background: var(--panel);
    }

    .stat strong,
    .stat span {
      display: block;
    }

    .stat strong {
      color: var(--accent);
      font-size: 1.3rem;
      line-height: 1.1;
    }

    .stat span {
      margin-top: 4px;
      color: var(--muted);
      font-size: 0.74rem;
      text-transform: uppercase;
    }

    .terminal-note {
      margin: 18px 0 0;
      color: var(--muted);
      font-size: 0.85rem;
    }

    .screen-reader-text {
      position: absolute;
      width: 1px;
      height: 1px;
      padding: 0;
      margin: -1px;
      overflow: hidden;
      clip: rect(0, 0, 0, 0);
      white-space: nowrap;
      border: 0;
    }

    .archive-controls {
      display: grid;
      grid-template-columns: minmax(0, 1fr) auto;
      gap: 10px;
      margin-top: 18px;
    }

    .search-field {
      min-width: 0;
      width: 100%;
      padding: 12px 14px;
      border: 1px solid var(--line);
      border-radius: 0;
      background: rgba(2, 4, 3, 0.92);
      color: var(--text);
      font: inherit;
      outline: none;
    }

    .search-field:focus {
      border-color: var(--accent);
      box-shadow: 0 0 0 2px rgba(88, 255, 135, 0.14);
    }

    .view-toggle {
      padding: 12px 14px;
      border: 1px solid var(--line);
      border-radius: 0;
      background: var(--panel-2);
      color: var(--accent);
      font: inherit;
      cursor: pointer;
    }

    .view-toggle:hover,
    .view-toggle:focus {
      border-color: var(--accent);
      color: var(--amber);
    }

    .filter-status {
      margin: 10px 0 0;
      color: var(--muted);
      font-size: 0.85rem;
    }

    .comment-list {
      display: grid;
      gap: 14px;
      margin-top: 24px;
    }

    .comment-entry {
      border: 1px solid var(--line-dim);
      background: rgba(7, 16, 11, 0.88);
      box-shadow: inset 3px 0 0 rgba(88, 255, 135, 0.3);
    }

    .comment-entry.is-hidden {
      display: none;
    }

    .comment-header {
      display: flex;
      flex-wrap: wrap;
      align-items: baseline;
      gap: 10px;
      padding: 10px 14px;
      border-bottom: 1px solid var(--line-dim);
      background: var(--panel-2);
      color: var(--muted);
      font-size: 0.9rem;
    }

    .entry-number {
      color: var(--amber);
    }

    .comment-text {
      margin: 0;
      padding: 16px 14px;
      overflow-x: auto;
      color: var(--text);
      font: inherit;
      white-space: pre-wrap;
      overflow-wrap: anywhere;
    }

    .meta-grid {
      display: grid;
      grid-template-columns: repeat(3, minmax(0, 1fr));
      gap: 1px;
      margin: 0;
      border-top: 1px solid var(--line-dim);
      background: var(--line-dim);
      font-size: 0.78rem;
    }

    .meta-item {
      min-width: 0;
      padding: 9px 10px;
      background: rgba(2, 4, 3, 0.92);
    }

    dt,
    dd {
      margin: 0;
    }

    dt {
      color: var(--muted);
      text-transform: uppercase;
    }

    dd {
      overflow-wrap: anywhere;
      color: var(--text);
    }

    .simple-view {
      display: none;
      grid-template-columns: minmax(190px, 0.18fr) minmax(0, 1fr) minmax(280px, 0.36fr);
      gap: 1px;
      background: var(--line-dim);
      font-size: 0.9rem;
    }

    .simple-date,
    .simple-comment {
      min-width: 0;
      padding: 10px 12px;
      background: rgba(2, 4, 3, 0.92);
    }

    .simple-date {
      color: var(--muted);
    }

    .simple-comment {
      margin: 0;
      color: var(--text);
      font: inherit;
      white-space: pre-wrap;
      overflow-wrap: anywhere;
    }

    .simple-embed {
      display: block;
      width: 100%;
      min-height: 180px;
      aspect-ratio: 16 / 9;
      border: 0;
      background: #000;
    }

    .simple-embed-missing {
      min-width: 0;
      padding: 10px 12px;
      background: rgba(2, 4, 3, 0.92);
      color: var(--muted);
    }

    body.simple-list .detail-view {
      display: none;
    }

    body.simple-list .simple-view {
      display: grid;
    }

    .archive-footer {
      margin-top: 28px;
      color: var(--muted);
      font-size: 0.8rem;
      text-align: center;
    }

    @media (max-width: 760px) {
      .archive-shell {
        width: min(100% - 20px, 1180px);
        padding: 18px 0 40px;
      }

      .archive-header {
        padding: 18px;
      }

      .stats,
      .meta-grid {
        grid-template-columns: 1fr;
      }

      .archive-controls,
      .simple-view {
        grid-template-columns: 1fr;
      }
    }
  </style>
</head>
<body>
  <main class="archive-shell">
    <header class="archive-header">
      <p class="kicker">/dead/messages/youtube-comments</p>
      <h1>YouTube Comments Archive</h1>
      <p class="subtitle">recovered from Google Takeout, sorted oldest first</p>
      <section class="stats" aria-label="Archive statistics">
        <div class="stat"><strong>${entries.length.toLocaleString("en-US")}</strong><span>comments rendered</span></div>
        <div class="stat"><strong>${csvFiles.length.toLocaleString("en-US")}</strong><span>csv files read</span></div>
        <div class="stat"><strong>${totalRows.toLocaleString("en-US")}</strong><span>rows scanned</span></div>
        <div class="stat"><strong>${duplicatesRemoved.toLocaleString("en-US")}</strong><span>duplicates removed</span></div>
        <div class="stat"><strong>${skippedRows.toLocaleString("en-US")}</strong><span>rows skipped</span></div>
      </section>
      <p class="terminal-note">static dump generated ${escapeHtml(generatedAt)}; no fetch, no trackers, no outside scripts</p>
      <div class="archive-controls" role="search">
        <label class="screen-reader-text" for="comment-search">Search comments</label>
        <input class="search-field" id="comment-search" type="search" placeholder="search comments, dates, ids, links..." autocomplete="off">
        <button class="view-toggle" id="view-toggle" type="button" aria-pressed="false">simple list view</button>
      </div>
      <p class="filter-status" id="filter-status" aria-live="polite">${entries.length.toLocaleString("en-US")} comments visible</p>
    </header>
    <section class="comment-list" aria-label="YouTube comments">
${renderedEntries}
    </section>
    <footer class="archive-footer">end of recovered transmission</footer>
  </main>
  <script>
    const entries = Array.from(document.querySelectorAll(".comment-entry"));
    const search = document.querySelector("#comment-search");
    const toggle = document.querySelector("#view-toggle");
    const status = document.querySelector("#filter-status");
    const total = entries.length;

    function pluralize(count, word) {
      return count === 1 ? word : word + "s";
    }

    function updateFilter() {
      const terms = search.value.trim().toLowerCase().split(/\\s+/).filter(Boolean);
      let visible = 0;

      for (const entry of entries) {
        const haystack = entry.dataset.search || "";
        const matched = terms.every((term) => haystack.includes(term));
        entry.classList.toggle("is-hidden", !matched);
        if (matched) {
          visible += 1;
        }
      }

      status.textContent = visible.toLocaleString("en-US") + " " + pluralize(visible, "comment") + " visible of " + total.toLocaleString("en-US");
    }

    function setSimpleView(enabled) {
      document.body.classList.toggle("simple-list", enabled);
      toggle.setAttribute("aria-pressed", String(enabled));
      toggle.textContent = enabled ? "detailed view" : "simple list view";
    }

    search.addEventListener("input", updateFilter);
    toggle.addEventListener("click", () => {
      setSimpleView(!document.body.classList.contains("simple-list"));
    });

    updateFilter();
  </script>
</body>
</html>
`;
}

function main() {
  const result = buildEntries();
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, buildHtml(result), "utf8");

  console.log(JSON.stringify({
    inputDir,
    outputPath,
    csvFilesRead: result.csvFiles.length,
    rowsScanned: result.totalRows,
    commentsRendered: result.entries.length,
    duplicatesRemoved: result.duplicatesRemoved,
    rowsSkipped: result.skippedRows,
  }, null, 2));
}

main();
