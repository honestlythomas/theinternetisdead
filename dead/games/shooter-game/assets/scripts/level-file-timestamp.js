(function(){
  const TIMESTAMP_SELECTOR = '[data-file-last-updated]';
  const TIME_ZONE = 'America/Toronto';

  function getTimestampTargets(){
    return Array.from(document.querySelectorAll(TIMESTAMP_SELECTOR));
  }

  function parseDocumentLastModified(){
    const raw = String(document.lastModified || '').trim();
    const timestamp = raw ? Date.parse(raw) : NaN;
    return Number.isFinite(timestamp) ? new Date(timestamp) : null;
  }

  function formatFileTimestamp(date){
    if (!(date instanceof Date) || Number.isNaN(date.getTime())) return '';

    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: TIME_ZONE,
      month: 'long',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    }).formatToParts(date);

    const partMap = parts.reduce((map, part) => {
      if (part.type !== 'literal') map[part.type] = part.value;
      return map;
    }, {});

    return `${partMap.month} ${partMap.day}, ${partMap.year} ${partMap.hour}:${partMap.minute} ${partMap.dayPeriod}`;
  }

  function updateTimestampNodes(date){
    const formatted = formatFileTimestamp(date);
    if (!formatted) return false;
    getTimestampTargets().forEach((node) => {
      node.textContent = `(Last updated: ${formatted})`;
      node.setAttribute('datetime', date.toISOString());
      node.dataset.fileLastUpdatedSource = 'Last-Modified';
    });
    return true;
  }

  async function readServedLastModified(){
    try{
      const response = await fetch(window.location.href, {
        method: 'HEAD',
        cache: 'no-store'
      });
      const header = response && response.headers ? response.headers.get('Last-Modified') : '';
      const timestamp = header ? Date.parse(header) : NaN;
      return Number.isFinite(timestamp) ? new Date(timestamp) : null;
    }catch(error){
      return null;
    }
  }

  async function syncFileTimestamp(){
    if (!getTimestampTargets().length) return;
    updateTimestampNodes(parseDocumentLastModified());
    const servedLastModified = await readServedLastModified();
    if (servedLastModified) updateTimestampNodes(servedLastModified);
  }

  if (document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', syncFileTimestamp, { once: true });
  } else {
    syncFileTimestamp();
  }
})();
