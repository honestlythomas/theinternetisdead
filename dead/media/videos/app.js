(() => {
  "use strict";

  const archive = window.ARCHIVE_DATA;
  if (!archive || !Array.isArray(archive.items)) {
    document.body.textContent = "ARCHIVE_DATA_FAILURE // archive-data.js is missing or malformed.";
    return;
  }

  const elements = {
    grid: document.getElementById("archiveGrid"),
    empty: document.getElementById("emptyState"),
    search: document.getElementById("searchInput"),
    sort: document.getElementById("sortSelect"),
    direction: document.getElementById("directionButton"),
    filters: [...document.querySelectorAll(".filter-button")],
    reset: document.getElementById("resetButton"),
    total: document.getElementById("totalCount"),
    videos: document.getElementById("videoCount"),
    shorts: document.getElementById("shortCount"),
    visible: document.getElementById("visibleCount"),
    generated: document.getElementById("generatedAt"),
    query: document.getElementById("queryReadout"),
    result: document.getElementById("resultReadout"),
    dialog: document.getElementById("detailDialog"),
    dialogContent: document.getElementById("detailContent"),
    dialogCoordinate: document.getElementById("dialogCoordinate"),
    dialogClose: document.getElementById("closeDialog")
  };

  const state = {
    query: "",
    filter: "All",
    sort: "uploadDate",
    direction: "desc"
  };

  const pad = (value) => String(value).padStart(3, "0");

  function formatDuration(seconds) {
    if (!Number.isFinite(seconds)) return "UNKNOWN";
    const rounded = Math.max(0, Math.round(seconds));
    const hours = Math.floor(rounded / 3600);
    const minutes = Math.floor((rounded % 3600) / 60);
    const remainder = rounded % 60;
    return hours
      ? `${hours}:${String(minutes).padStart(2, "0")}:${String(remainder).padStart(2, "0")}`
      : `${minutes}:${String(remainder).padStart(2, "0")}`;
  }

  function formatViews(value) {
    return Number.isFinite(value)
      ? new Intl.NumberFormat("en-US").format(value)
      : "UNKNOWN";
  }

  function formatDate(value) {
    if (!value) return "UNKNOWN";
    const date = new Date(`${value}T00:00:00`);
    return Number.isNaN(date.valueOf())
      ? value
      : new Intl.DateTimeFormat("en-US", {
          year: "numeric",
          month: "short",
          day: "2-digit"
        }).format(date);
  }

  function formatBuildTime(value) {
    if (!value) return "BUILD // UNKNOWN";
    const date = new Date(value);
    return Number.isNaN(date.valueOf())
      ? `BUILD // ${value}`
      : `BUILD // ${date.toLocaleString()}`;
  }

  function searchableText(item) {
    return [
      item.title,
      item.id,
      item.classification,
      item.contentType,
      item.uploadDate,
      item.description,
      item.channelName,
      item.channelId,
      item.uploader,
      item.sourceUrl,
      item.availability,
      item.liveStatus,
      JSON.stringify(item.additionalMetadata || {})
    ].filter(Boolean).join(" ").toLocaleLowerCase();
  }

  archive.items.forEach((item) => {
    item._search = searchableText(item);
  });

  function compareNullable(left, right, direction) {
    const leftMissing = left === null || left === undefined || left === "";
    const rightMissing = right === null || right === undefined || right === "";
    if (leftMissing && rightMissing) return 0;
    if (leftMissing) return 1;
    if (rightMissing) return -1;
    if (typeof left === "string" && typeof right === "string") {
      return left.localeCompare(right, undefined, { sensitivity: "base", numeric: true }) * direction;
    }
    return (left - right) * direction;
  }

  function getVisibleItems() {
    const normalizedQuery = state.query.trim().toLocaleLowerCase();
    const direction = state.direction === "asc" ? 1 : -1;
    return archive.items
      .filter((item) => state.filter === "All" || item.classification === state.filter)
      .filter((item) => !normalizedQuery || item._search.includes(normalizedQuery))
      .sort((a, b) => {
        const primary = compareNullable(a[state.sort], b[state.sort], direction);
        return primary || a.title.localeCompare(b.title, undefined, { sensitivity: "base" });
      });
  }

  function makeElement(tag, className, text) {
    const element = document.createElement(tag);
    if (className) element.className = className;
    if (text !== undefined) element.textContent = text;
    return element;
  }

  function makeCard(item, index) {
    const article = makeElement(
      "article",
      `archive-card${item.classification === "Shorts" ? " archive-card--short" : ""}`
    );
    article.dataset.id = item.id;
    article.dataset.classification = item.classification;

    const button = makeElement("button", "card-open");
    button.type = "button";
    button.setAttribute("aria-label", `Open archive details for ${item.title}`);
    button.addEventListener("click", () => openDetail(item));

    const frame = makeElement("div", "thumbnail-frame");
    const image = document.createElement("img");
    image.src = item.thumbnail;
    image.alt = "";
    image.loading = index < 8 ? "eager" : "lazy";
    image.decoding = "async";
    const coordinate = makeElement(
      "span",
      "card-coordinate",
      `X:${pad(index + 1)} Y:${item.classification === "Shorts" ? "S" : "V"}`
    );
    frame.append(image, coordinate);

    const body = makeElement("div", "card-body");
    const labelRow = makeElement("div", "card-label-row");
    labelRow.append(
      makeElement("span", "type-label", item.contentType.toLocaleUpperCase()),
      makeElement("span", "record-number", `REC_${pad(index + 1)}`)
    );
    const title = makeElement("h2", "card-title", item.title);
    const metrics = makeElement("div", "card-metrics");
    metrics.append(
      makeElement("span", "", `DATE ${formatDate(item.uploadDate)}`),
      makeElement("span", "", `T ${formatDuration(item.durationSeconds)}`),
      makeElement("span", "", `V ${formatViews(item.viewCount)}`)
    );
    const id = makeElement("div", "video-id");
    id.append(makeElement("b", "", "ID // "), document.createTextNode(item.id));
    body.append(labelRow, title, metrics, id);
    button.append(frame, body);
    article.append(button);
    return article;
  }

  function render() {
    const visibleItems = getVisibleItems();
    const fragment = document.createDocumentFragment();
    visibleItems.forEach((item, index) => fragment.append(makeCard(item, index)));
    elements.grid.replaceChildren(fragment);
    elements.grid.hidden = visibleItems.length === 0;
    elements.empty.hidden = visibleItems.length !== 0;
    elements.visible.textContent = pad(visibleItems.length);
    elements.result.textContent = `RETURNING ${pad(visibleItems.length)} / ${pad(archive.stats.total)}`;
    const queryLabel = state.query.trim() ? `"${state.query.trim()}"` : "∅";
    elements.query.textContent =
      `QUERY // ${queryLabel} :: SET ${state.filter.toLocaleUpperCase()} :: SORT ${state.sort.toLocaleUpperCase()} ${state.direction.toLocaleUpperCase()}`;
  }

  function displayValue(value) {
    if (value === null || value === undefined || value === "") return "NOT_AVAILABLE";
    if (typeof value === "boolean") return value ? "TRUE" : "FALSE";
    if (typeof value === "object") return JSON.stringify(value, null, 2);
    return String(value);
  }

  function dataCell(label, value) {
    const wrapper = makeElement("div", "data-cell");
    const term = makeElement("dt", "", label);
    const missing = value === null || value === undefined || value === "";
    const description = makeElement("dd", missing ? "is-missing" : "", displayValue(value));
    wrapper.append(term, description);
    return wrapper;
  }

  function openDetail(item) {
    const layout = makeElement("article", "detail-layout");
    const visual = makeElement("div", "detail-visual");
    const image = document.createElement("img");
    image.src = item.thumbnail;
    image.alt = `Thumbnail for ${item.title}`;
    const axis = makeElement("div", "detail-axis");
    axis.append(
      makeElement("span", "", "X:0.000"),
      makeElement("span", "", `${item.thumbnailWidth} × ${item.thumbnailHeight}`),
      makeElement("span", "", "X:1.000")
    );
    visual.append(image, axis);

    const copy = makeElement(
      "div",
      `detail-copy${item.classification === "Shorts" ? " detail-copy--short" : ""}`
    );
    copy.append(makeElement("span", "type-label", item.contentType.toLocaleUpperCase()));
    const heading = makeElement("h2", "", item.title);
    heading.id = "detailTitle";
    const description = makeElement(
      "p",
      `detail-description${item.description ? "" : " is-missing"}`,
      item.description || "DESCRIPTION_FIELD // NOT_AVAILABLE"
    );
    const sourceLink = makeElement("a", "youtube-link", "OPEN ORIGINAL YOUTUBE ↗");
    sourceLink.href = item.sourceUrl;
    sourceLink.target = "_blank";
    sourceLink.rel = "noopener noreferrer";
    copy.append(heading, description, sourceLink);

    const database = makeElement("dl", "detail-database");
    const coreFields = [
      ["VIDEO_ID", item.id],
      ["CONTENT_TYPE", item.contentType],
      ["CLASSIFICATION", item.classification],
      ["UPLOAD_DATE", formatDate(item.uploadDate)],
      ["DURATION", Number.isFinite(item.durationSeconds) ? `${formatDuration(item.durationSeconds)} (${item.durationSeconds}s)` : null],
      ["VIEW_COUNT", Number.isFinite(item.viewCount) ? formatViews(item.viewCount) : null],
      ["CHANNEL_NAME", item.channelName],
      ["CHANNEL_ID", item.channelId],
      ["UPLOADER", item.uploader],
      ["AVAILABILITY", item.availability],
      ["LIVE_STATUS", item.liveStatus],
      ["SOURCE_URL", item.sourceUrl],
      ["THUMBNAIL_FILE", item.thumbnailFilename],
      ["THUMBNAIL_COPY", item.thumbnail],
      ["IMAGE_DIMENSIONS", `${item.thumbnailWidth} × ${item.thumbnailHeight}`],
      ["IMAGE_BYTES", formatViews(item.thumbnailFileSizeBytes)]
    ];
    coreFields.forEach(([label, value]) => database.append(dataCell(label, value)));
    Object.entries(item.additionalMetadata || {}).forEach(([key, value]) => {
      database.append(dataCell(`META_${key}`, value));
    });

    layout.append(visual, copy, database);
    elements.dialogContent.replaceChildren(layout);
    elements.dialogCoordinate.textContent = `RECORD // ${item.id} // ${item.classification.toLocaleUpperCase()}`;
    elements.dialog.showModal();
    history.replaceState(null, "", `#${encodeURIComponent(item.id)}`);
  }

  function closeDetail() {
    elements.dialog.close();
    history.replaceState(null, "", location.pathname + location.search);
  }

  elements.search.addEventListener("input", (event) => {
    state.query = event.target.value;
    render();
  });

  elements.filters.forEach((button) => {
    button.addEventListener("click", () => {
      state.filter = button.dataset.filter;
      elements.filters.forEach((candidate) => {
        const active = candidate === button;
        candidate.classList.toggle("is-active", active);
        candidate.setAttribute("aria-pressed", String(active));
      });
      render();
    });
  });

  elements.sort.addEventListener("change", (event) => {
    state.sort = event.target.value;
    render();
  });

  elements.direction.addEventListener("click", () => {
    state.direction = state.direction === "asc" ? "desc" : "asc";
    const descending = state.direction === "desc";
    elements.direction.dataset.direction = state.direction;
    elements.direction.innerHTML = `<span aria-hidden="true">${descending ? "↓" : "↑"}</span> ${descending ? "DESC" : "ASC"}`;
    elements.direction.setAttribute("aria-label", `Sort ${descending ? "descending" : "ascending"}`);
    render();
  });

  elements.reset.addEventListener("click", () => {
    state.query = "";
    state.filter = "All";
    elements.search.value = "";
    elements.filters.forEach((button) => {
      const active = button.dataset.filter === "All";
      button.classList.toggle("is-active", active);
      button.setAttribute("aria-pressed", String(active));
    });
    render();
    elements.search.focus();
  });

  elements.dialogClose.addEventListener("click", closeDetail);
  elements.dialog.addEventListener("click", (event) => {
    if (event.target === elements.dialog) closeDetail();
  });
  elements.dialog.addEventListener("close", () => {
    if (location.hash) history.replaceState(null, "", location.pathname + location.search);
  });

  elements.total.textContent = pad(archive.stats.total);
  elements.videos.textContent = pad(archive.stats.videos);
  elements.shorts.textContent = pad(archive.stats.shorts);
  elements.generated.textContent = formatBuildTime(archive.generatedAt);
  render();

  const initialId = decodeURIComponent(location.hash.slice(1));
  if (initialId) {
    const item = archive.items.find((candidate) => candidate.id === initialId);
    if (item) openDetail(item);
  }
})();
