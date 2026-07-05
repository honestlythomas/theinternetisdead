async function loadOverlay(){
    try{
        const res = await fetch("/nav.html", { cache: "no-store" });
        if(!res.ok) throw new Error("Failed to load /nav.html");
        const html = await res.text();
        const container = document.getElementById("overlay-container");
        const temp = document.createElement("div");
        temp.innerHTML = html;

        const fragment = document.createDocumentFragment();
        const scripts = [];

        Array.from(temp.childNodes).forEach((node) => {
            if (node.nodeName && node.nodeName.toLowerCase() === "script") {
                scripts.push(node);
            } else {
                fragment.appendChild(node.cloneNode(true));
            }
        });

        container.innerHTML = "";
        container.appendChild(fragment);

        scripts.forEach((oldScript) => {
            const newScript = document.createElement("script");
            Array.from(oldScript.attributes).forEach((attr) => {
                newScript.setAttribute(attr.name, attr.value);
            });
            newScript.textContent = oldScript.textContent;
            container.appendChild(newScript);
        });

        syncLayout();
        syncOverlayClockState();
    }catch(error){
        console.error("Error loading overlay:", error);
    }
}

const frame = document.getElementById("chat-sandbox-frame");


function openEmbeddedChatWithWelcome(){
    postToChatSandbox({ type: 'chatSandboxOpen', focus: false });
}

if (frame) {
    frame.addEventListener('load', () => {
        openEmbeddedChatWithWelcome();
        registerPageCommands();
    });
}

const defaultClockZone = 'America/Toronto';
const allClockZones = typeof Intl.supportedValuesOf === 'function'
    ? Array.from(new Set(['America/Toronto', ...Intl.supportedValuesOf('timeZone')])).sort((a, b) => a.localeCompare(b))
    : ['America/Toronto', 'UTC'];
let overlayClockState = {
    mode: 'time',
    zone: defaultClockZone,
    manualTime: '',
    manualDate: ''
};
let siteClockBaseDate = null;
let siteClockAnchorMs = Date.now();

function sanitizeClockZone(zone){
    const safe = typeof zone === 'string' ? zone.trim() : '';
    return allClockZones.includes(safe) ? safe : defaultClockZone;
}

function getZonedDate(now = new Date(), zone = defaultClockZone){
    const parts = new Intl.DateTimeFormat('en-CA', {
        timeZone: sanitizeClockZone(zone),
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false
    }).formatToParts(now).reduce((acc, part) => {
        if (part.type !== 'literal') acc[part.type] = part.value;
        return acc;
    }, {});
    return new Date(
        Number(parts.year),
        Number(parts.month) - 1,
        Number(parts.day),
        Number(parts.hour),
        Number(parts.minute),
        Number(parts.second),
        now.getMilliseconds()
    );
}

function parseManualTime(value){
    const raw = String(value || '').trim();
    const match = raw.match(/^(\d{1,2})(?::(\d{2}))?(?::(\d{2}))?\s*(am|pm)?$/i);
    if (!match) return null;
    let hour = Number(match[1]);
    const minute = Number(match[2] || '0');
    const second = Number(match[3] || '0');
    const meridiem = (match[4] || '').toLowerCase();
    if (meridiem) {
        if (hour < 1 || hour > 12) return null;
        if (meridiem === 'pm' && hour !== 12) hour += 12;
        if (meridiem === 'am' && hour === 12) hour = 0;
    }
    if (hour > 23 || minute > 59 || second > 59) return null;
    return { hour, minute, second };
}

function parseManualDate(value, fallbackDate = new Date()){
    const raw = String(value || '').trim();
    if (!raw) return { year: fallbackDate.getFullYear(), month: fallbackDate.getMonth(), day: fallbackDate.getDate() };
    const iso = raw.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
    if (iso) {
        return { year: Number(iso[1]), month: Number(iso[2]) - 1, day: Number(iso[3]) };
    }
    const parsed = new Date(raw);
    if (Number.isNaN(parsed.getTime())) {
        return { year: fallbackDate.getFullYear(), month: fallbackDate.getMonth(), day: fallbackDate.getDate() };
    }
    return { year: parsed.getFullYear(), month: parsed.getMonth(), day: parsed.getDate() };
}

function getSiteNow(){
    if (siteClockBaseDate instanceof Date && !Number.isNaN(siteClockBaseDate.getTime())) {
        return new Date(siteClockBaseDate.getTime() + (Date.now() - siteClockAnchorMs));
    }
    return getZonedDate(new Date(), overlayClockState.zone);
}
window.__getSiteNow = getSiteNow;

function syncSiteClockBase(){
    const current = getSiteNow();
    const next = new Date(current.getTime());
    if (overlayClockState.manualDate) {
        const parsedDate = parseManualDate(overlayClockState.manualDate, current);
        next.setFullYear(parsedDate.year, parsedDate.month, parsedDate.day);
    }
    if (overlayClockState.manualTime) {
        const parsedTime = parseManualTime(overlayClockState.manualTime);
        if (parsedTime) {
            next.setHours(parsedTime.hour, parsedTime.minute, parsedTime.second, 0);
        }
    }
    if (overlayClockState.manualDate || overlayClockState.manualTime) {
        siteClockBaseDate = next;
        siteClockAnchorMs = Date.now();
    } else {
        siteClockBaseDate = null;
        siteClockAnchorMs = Date.now();
    }
}

function getOverlayClockStateSnapshot(){
    return {
        mode: overlayClockState.mode === 'date' ? 'date' : 'time',
        zone: sanitizeClockZone(overlayClockState.zone),
        manualTime: typeof overlayClockState.manualTime === 'string' ? overlayClockState.manualTime : '',
        manualDate: typeof overlayClockState.manualDate === 'string' ? overlayClockState.manualDate : ''
    };
}

function syncOverlayClockState(){
    const clockState = getOverlayClockStateSnapshot();
    window.__overlayClockState = clockState;
    syncSiteClockBase();
    if (typeof window.setOverlayClockState === 'function') {
        try { window.setOverlayClockState(clockState); } catch(error) { console.warn(error); }
    }
}

function setOverlayClockStateFromPage(nextState = {}){
    overlayClockState = {
        ...getOverlayClockStateSnapshot(),
        ...(nextState && typeof nextState === 'object' ? nextState : {})
    };
    overlayClockState.mode = overlayClockState.mode === 'date' ? 'date' : 'time';
    overlayClockState.zone = sanitizeClockZone(overlayClockState.zone);
    overlayClockState.manualTime = typeof overlayClockState.manualTime === 'string' ? overlayClockState.manualTime.trim() : '';
    overlayClockState.manualDate = typeof overlayClockState.manualDate === 'string' ? overlayClockState.manualDate.trim() : '';
    syncOverlayClockState();
    return getOverlayClockStateSnapshot();
}

function postToChatSandbox(message){
    if (frame && frame.contentWindow) {
        frame.contentWindow.postMessage(message, '*');
    }
}

function registerPageCommands(){
    postToChatSandbox({
        type: 'pageChatRegister',
        pageOnly: false,
        pageId: 'chat-sandbox-wrapper',
        title: 'Chat Sandbox Wrapper',
        sourceKey: 'chat-sandbox-wrapper',
        commands: [
            { name: '/clock_time', usage: '/clock_time ', desc: 'set the overlay clock to a manual time string', execute: false },
            { name: '/clock_date', usage: '/clock_date ', desc: 'set the overlay clock to a manual date string', execute: false },
            { name: '/clock_reset', usage: '/clock_reset', desc: 'reset the overlay clock to live Toronto time', execute: true },
            { name: '/clock_zone', usage: '/clock_zone America/Toronto', desc: 'sync the overlay clock to a named timezone', execute: false, suggestions: allClockZones }
        ]
    });
}

function renderFatalExitScreen(){
    const escaped = [
        '            .ed"""" """$$$$be.',
        '          -"           ^""**$$$e.',
        '        ."                   \'$$$c',
        '       /                      "4$$b',
        '      d  3                      $$$$',
        '      $  *                   .$$$$$$',
        '     .$  ^c           $$$$$e$$$$$$$$.',
        '     d$L  4.         4$$$$$$$$$$$$$$b',
        '     $$$$b ^ceeeee.  4$$ECL.F*$$$$$$$',
        '     $$$$P d$$$$F $ $$$$$$$$$- $$$$$$',
        '     3$$$F "$$$$b   $"$$$$$$$  $$$$*"',
        '      $$P"  "$$b   .$ $$$$$...e$$',
        '       *c    ..    $$ 3$$$$$$$$$$eF',
        '         %ce"    $$$  $$$$$$$$$$*',
        '          *$e.    "$  $$$$$$$$$P',
        '           $$$      4J$$$$$$$"',
        '          $"$   $"*$$$$$$$$$B',
        '          $  "F"   ^*$$$$$$$*',
        '           $"     .d$$$$$$$',
        '           ^%ceeed$$$$$$$$$*',
        '              """*$$$$$$$$$*',
        '                   ^""""',
        '',
        'BOOT STATUS: PAGE FATALITY',
        'CAUSE: USER EXECUTED /exit',
        'RESULT: you killed the page',
        '',
        'Manual reboot required.',
        'Refresh the page like a peasant.'
    ].join('\n');

    document.documentElement.innerHTML = `
        <head>
            <meta charset="UTF-8" />
            <title>/exit</title>
            <style>
                html, body { margin: 0; width: 100%; height: 100%; background: #000; overflow: hidden; }
                body { display: flex; align-items: center; justify-content: center; padding: 24px; box-sizing: border-box; color: #00ff66; font-family: "Courier New", Courier, monospace; background:
                    radial-gradient(circle at 20% 20%, rgba(255, 0, 80, 0.28), transparent 28%),
                    radial-gradient(circle at 80% 25%, rgba(0, 255, 120, 0.24), transparent 26%),
                    radial-gradient(circle at 50% 80%, rgba(0, 140, 255, 0.24), transparent 30%),
                    #000; }
                pre { margin: 0; white-space: pre; font-size: clamp(10px, 1.35vw, 16px); line-height: 1.1; color: #00ff66; text-shadow: 0 0 8px rgba(0, 255, 102, 0.35); background: rgba(0, 0, 0, 0.38); padding: 18px 20px 30px 20px; box-shadow: 0 0 0 1px rgba(0, 255, 102, 0.18), inset 0 0 24px rgba(0, 0, 0, 0.45); transform-origin: 0 0; animation: fatal-skull-glitch 1.15s steps(2, end) infinite; }
                @keyframes fatal-skull-glitch {
                    0%, 100% { opacity: 1; transform: translate(0, 0) skewX(0deg); text-shadow: 0 0 8px rgba(0, 255, 102, 0.35); }
                    12% { opacity: 0.82; transform: translate(2px, -1px) skewX(-1deg); text-shadow: -2px 0 rgba(255, 0, 80, 0.65), 2px 0 rgba(0, 140, 255, 0.55), 0 0 10px rgba(0, 255, 102, 0.5); }
                    14% { opacity: 1; transform: translate(-1px, 1px) skewX(1deg); }
                    42% { opacity: 0.9; transform: translate(1px, 0) skewX(0deg); }
                    44% { opacity: 1; transform: translate(-2px, 0) skewX(1deg); text-shadow: 2px 0 rgba(255, 0, 80, 0.55), -2px 0 rgba(0, 140, 255, 0.5), 0 0 12px rgba(0, 255, 102, 0.55); }
                    68% { opacity: 0.78; transform: translate(0, 1px) skewX(-1deg); }
                    70% { opacity: 1; transform: translate(0, 0) skewX(0deg); }
                }
            </style>
        </head>
        <body><pre>${escaped}</pre></body>
    `;
}

function syncLayout(){
    const overlayContainer = document.getElementById("overlay-container");
    const overlayHeight = overlayContainer ? overlayContainer.offsetHeight : 0;
    frame.style.top = overlayHeight + "px";
    frame.style.height = "calc(100dvh - " + overlayHeight + "px)";
}

window.syncOverlayLayout = syncLayout;


window.addEventListener('message', (event) => {
    if (!event.data) return;
    if (event.source === (frame ? frame.contentWindow : null)) {
        if (event.data.type === 'chatSandboxState' || event.data.type === 'chatSandboxDvdState') {
            return;
        }
        if (event.data.type === 'pageExit') {
            renderFatalExitScreen();
            return;
        }
        if (event.data.type === 'pageChatExecute') {
            const commandName = String(event.data.command || '').toLowerCase();
            const rawCommand = typeof event.data.raw === 'string' ? event.data.raw.trim() : '';
            const commandValue = rawCommand ? rawCommand.slice(commandName.length).trim() : '';
            if (commandName === '/clock_time') {
                if (!commandValue) {
                    postToChatSandbox({ type: 'pageChatResult', command: '/clock_time', message: 'Usage: /clock_time [time]', announce: true });
                    return;
                }
                setOverlayClockStateFromPage({ mode: 'time', manualTime: commandValue });
                postToChatSandbox({ type: 'pageChatResult', command: '/clock_time', message: `/clock_time executed: ${commandValue}`, announce: true });
                return;
            }
            if (commandName === '/clock_date') {
                if (!commandValue) {
                    postToChatSandbox({ type: 'pageChatResult', command: '/clock_date', message: 'Usage: /clock_date [date]', announce: true });
                    return;
                }
                setOverlayClockStateFromPage({ mode: 'date', manualDate: commandValue });
                postToChatSandbox({ type: 'pageChatResult', command: '/clock_date', message: `/clock_date executed: ${commandValue}`, announce: true });
                return;
            }
            if (commandName === '/clock_reset') {
                setOverlayClockStateFromPage({ mode: 'time', zone: defaultClockZone, manualTime: '', manualDate: '' });
                postToChatSandbox({ type: 'pageChatResult', command: '/clock_reset', message: '/clock_reset executed: synced to America/Toronto', announce: true });
                return;
            }
            if (commandName === '/clock_zone') {
                const nextZone = sanitizeClockZone(commandValue);
                if (!commandValue) {
                    postToChatSandbox({ type: 'pageChatResult', command: '/clock_zone', message: 'Usage: /clock_zone [timezone]', announce: true });
                    return;
                }
                if (nextZone !== commandValue.trim()) {
                    postToChatSandbox({ type: 'pageChatResult', command: '/clock_zone', message: `Unknown timezone: ${commandValue}`, announce: true });
                    return;
                }
                setOverlayClockStateFromPage({ zone: nextZone, manualTime: '', manualDate: '' });
                postToChatSandbox({ type: 'pageChatResult', command: '/clock_zone', message: `/clock_zone executed: synced to ${nextZone}`, announce: true });
                return;
            }
        }
    }
});

loadOverlay();

window.addEventListener("resize", syncLayout);
window.addEventListener("orientationchange", syncLayout);
window.addEventListener("load", syncLayout);
frame.addEventListener('load', registerPageCommands);

const resizeObserver = new ResizeObserver(syncLayout);
resizeObserver.observe(document.getElementById("overlay-container"));
