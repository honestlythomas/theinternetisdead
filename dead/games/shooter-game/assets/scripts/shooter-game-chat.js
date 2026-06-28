    const tektiteFrame = document.getElementById('tektite-frame');
    const chatSandboxFrame = document.getElementById('chat-sandbox-frame');
const LEVEL1_SRC = '/dead/games/shooter-game/assets/levels/shooter-game-level1.html';
const LEVEL2_SRC = '/dead/games/shooter-game/assets/levels/shooter-game-level2.html?autostart=1&startWave=1';

    function buildLevel2Src() {
      return `${LEVEL2_SRC}&reload=${Date.now()}`;
    }

    function resetGameLoopWatch(options = {}) {
      try {
        if (typeof window.__tektiteResetGameLoopWatch === 'function') {
          window.__tektiteResetGameLoopWatch(options);
        }
      } catch (error) {}
    }

    function forceGameLoopFailureBackground() {
      try {
        if (typeof window.__tektiteShowGameLoopFailure === 'function') {
          window.__tektiteShowGameLoopFailure();
          return;
        }
      } catch (error) {}
      document.body.classList.add('game-loop-failed');
    }

    function clearForcedGameLoopFailureBackground() {
      try {
        if (typeof window.__tektiteClearForcedGameLoopFailure === 'function') {
          window.__tektiteClearForcedGameLoopFailure();
          return;
        }
      } catch (error) {}
      resetGameLoopWatch({ clearForced: true });
    }

    if (tektiteFrame) {
      tektiteFrame.addEventListener('load', resetGameLoopWatch);
    }
    const shooterPageCommands = [
      { name: '/background_color', desc: 'Set starfield background color', usage: '/background_color [name|hex]', suggestions: ['black', 'purple', 'lime', '#110019'] },
      { name: '/cheatermode', desc: 'Unlock cheat commands by typing the passphrase', usage: '/cheatermode', suggestions: ['cheatermode'], unlockOnly: true },
      { name: '/jinclops', desc: 'Hidden: set nickname to Jinclops and unlock cheat commands', usage: '/jinclops', hidden: true },
      { name: '/tektite', desc: 'Hidden: set nickname to Tektite and unlock cheat commands', usage: '/tektite', hidden: true },
      { name: '/debug', desc: 'Hidden: toggle shooter-game debug styling without using chat-sandbox built-ins', usage: '/debug', hidden: true, replaceBuiltIn: true },
      { name: '/bombs', desc: 'Set bombs to 0-99, or 100/INFINITE', usage: '/bombs [0-99|100|INFINITE]', suggestions: ['0', '3', '5', '99', '100', 'INFINITE'], cheatOnly: true },
      { name: '/fullscreen', desc: 'Toggle fullscreen', usage: '/fullscreen' },
      { name: '/game_speed', desc: 'Set game speed -5..20. 0 starts frozen staring-contest mode, 1 is normal', usage: '/game_speed [-5..20]', suggestions: ['-5', '0', '1', '5', '10', '20'], cheatOnly: true },
      { name: '/hearts', desc: 'Set max hearts to 1-99, or 100/INFINITE', usage: '/hearts [1-99|100|INFINITE]', suggestions: ['1', '4', '8', '99', '100', 'INFINITE'], cheatOnly: true },
      { name: '/infinite', desc: 'Toggle global infinite mode, or set one resource to infinite', usage: '/infinite', suggestions: ['hearts', 'shields', 'lives', 'bombs'], cheatOnly: true },
      { name: '/color_invert', desc: 'Toggle invert colors', usage: '/color_invert' },
      { name: '/lives', desc: 'Set lives to 0-99, or 100/INFINITE', usage: '/lives [0-99|100|INFINITE]', suggestions: ['0', '3', '5', '99', '100', 'INFINITE'], cheatOnly: true },
      { name: '/log', desc: 'Show the visible Last updated timestamp for the current level', usage: '/log' },
      { name: '/stop', desc: 'Testing: close the level iframe and expose the host 404 fallback', usage: '/stop', cheatOnly: true, hidden: true },
      { name: '/start', desc: 'Testing: reload Level 1 normally after /stop', usage: '/start', cheatOnly: true, hidden: true },
      { name: '/mute', desc: 'Toggle all shooter audio on or off', usage: '/mute' },
      { name: '/nickname', desc: 'Set the displayed username used by system messages', usage: '/nickname ', suggestions: ['Tektite', 'Guest', 'User'] },
      { name: '/reset', desc: 'Hidden: wipe browser site data and sever saved-image folder links', usage: '/reset', hidden: true },
      { name: '/shields', desc: 'Set shields to 0-99, or 100/INFINITE', usage: '/shields [0-99|100|INFINITE]', suggestions: ['0', '1', '3', '99', '100', 'INFINITE'], cheatOnly: true },
      { name: '/shoot', desc: 'Set player bullet mode', usage: '/shoot [normal|big_bullets|glitch]', suggestions: ['normal', 'big_bullets', 'glitch'], cheatOnly: true },
      { name: '/screenshot', desc: 'Save a browser-matched screenshot to Profile > Saved Images', usage: '/screenshot' },
      { name: '/video_fx', desc: 'Toggle video effects on or off', usage: '/video_fx' }
    ];
    let hasSwitchedToLevel2 = false;
    let shooterCheatsUnlocked = false;
    let shooterDebugMode = false;
    let chatSandboxVisible = false;
    let chatSandboxReady = false;
    let chatValuePickerActive = false;
    let chatValuePickerCommand = '';
    let pendingChatOpenOptions = null;
    let chatControllerTargetIndex = -1;
    let shooterActiveInputMode = 'keyboardMouse';

    function getChatWindow() {
      return chatSandboxFrame && chatSandboxFrame.contentWindow ? chatSandboxFrame.contentWindow : null;
    }

    function postToChatSandbox(payload) {
      const chatWindow = getChatWindow();
      if (!chatWindow) return;
      chatWindow.postMessage(payload, '*');
    }

    function postInputModeToChatSandbox() {
      postToChatSandbox({
        type: 'chatSandboxInputMode',
        mode: shooterActiveInputMode
      });
    }

    function postCheatermodeHoldStateToChatSandbox(data = {}) {
      postToChatSandbox({
        type: 'chatSandboxCheatermodeHoldState',
        active: !!data.active,
        remaining: Math.max(0, Math.ceil(Number(data.remaining) || 0)),
        totalSeconds: Math.max(1, Math.ceil(Number(data.totalSeconds) || 5)),
        unlocked: !!data.unlocked,
        xPressed: !!data.xPressed,
        viewPressed: !!data.viewPressed
      });
    }

    function notifyChildChatVisibility() {
      try {
        if (tektiteFrame && tektiteFrame.contentWindow) {
          tektiteFrame.contentWindow.postMessage({
            type: 'tektite:chat-visibility',
            visible: !!chatSandboxVisible,
            valuePickerActive: !!chatValuePickerActive,
            valuePickerCommand: chatValuePickerCommand
          }, '*');
        }
      } catch (error) {}
    }

    function notifyChildFullscreenState() {
      try {
        if (tektiteFrame && tektiteFrame.contentWindow) {
          tektiteFrame.contentWindow.postMessage({
            type: 'tektite:fullscreen-state',
            active: !!document.fullscreenElement
          }, '*');
        }
      } catch (error) {}
    }


    const CHAT_NICKNAME_STORAGE_KEY = 'tektiteChatNickname';
    const CHAT_NICKNAME_EXPLICIT_STORAGE_KEY = 'tektiteChatNicknameExplicit';
    const CHAT_NICKNAME_HISTORY_STORAGE_KEY = 'tektiteShooterNicknameHistory';
    const LIFETIME_STATS_PROFILES_STORAGE_KEY = 'tektiteShooterLevel1LifetimeStatsByNickname';
    const SHOOTER_CHAT_NICKNAME_MAX_LENGTH = 8;
    const SHOOTER_NICKNAME_SUGGESTION_MAX = 9;

    function limitShooterNicknameLength(value) {
      return Array.from(String(value || '')).slice(0, SHOOTER_CHAT_NICKNAME_MAX_LENGTH).join('');
    }

    function getShooterNicknameDedupKey(nickname) {
      return limitShooterNicknameLength(String(nickname || '').trim()).toLowerCase();
    }

    function pushUniqueShooterNickname(target, seenKeys, nickname) {
      const normalized = limitShooterNicknameLength(String(nickname || '').trim());
      const key = getShooterNicknameDedupKey(normalized);
      if (!normalized || !key || seenKeys.has(key)) return false;
      seenKeys.add(key);
      target.push(normalized);
      return true;
    }

    function readShooterNicknameHistory() {
      try {
        const parsed = JSON.parse(window.localStorage.getItem(CHAT_NICKNAME_HISTORY_STORAGE_KEY) || '[]');
        if (!Array.isArray(parsed)) return [];
        const unique = [];
        const seenKeys = new Set();
        for (const value of parsed) {
          pushUniqueShooterNickname(unique, seenKeys, value);
          if (unique.length >= SHOOTER_NICKNAME_SUGGESTION_MAX) break;
        }
        return unique;
      } catch (error) {
        return [];
      }
    }

    function readShooterLifetimeStatsProfiles() {
      try {
        const parsed = JSON.parse(window.localStorage.getItem(LIFETIME_STATS_PROFILES_STORAGE_KEY) || '{}');
        return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
      } catch (error) {
        return {};
      }
    }

    function getSavedShooterNicknameSuggestions() {
      const combined = [];
      const seenKeys = new Set();
      const history = readShooterNicknameHistory();
      const profileNames = Object.keys(readShooterLifetimeStatsProfiles())
        .map((key) => {
          const match = /^name:(.+)$/i.exec(String(key || ''));
          return match ? limitShooterNicknameLength(match[1]) : '';
        })
        .filter(Boolean);
      for (const nickname of [...history, ...profileNames]) {
        pushUniqueShooterNickname(combined, seenKeys, nickname);
        if (combined.length >= SHOOTER_NICKNAME_SUGGESTION_MAX) break;
      }
      return combined.sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }));
    }

    function getSavedShooterNicknameValue() {
      try {
        const savedNickname = window.localStorage.getItem(CHAT_NICKNAME_STORAGE_KEY);
        const normalized = savedNickname && savedNickname.trim() ? savedNickname.trim() : '';
        const isExplicit = window.localStorage.getItem(CHAT_NICKNAME_EXPLICIT_STORAGE_KEY) === 'true';
        if (normalized === 'User' && !isExplicit) return '';
        return Array.from(normalized).slice(0, 8).join('');
      } catch (error) {
        return '';
      }
    }

    function getShooterLevelSavedImageMetadata() {
      try {
        const frameWindow = tektiteFrame && tektiteFrame.contentWindow ? tektiteFrame.contentWindow : null;
        if (frameWindow && typeof frameWindow.tektiteGetSavedImageMetadata === 'function') {
          const metadata = frameWindow.tektiteGetSavedImageMetadata();
          return metadata && typeof metadata === 'object' ? metadata : null;
        }
      } catch (error) {}
      return null;
    }

    function getShooterSavedImageMetadata(options = {}) {
      const metadata = getShooterLevelSavedImageMetadata();
      const nickname = String(
        options.nickname ||
        (metadata && metadata.nickname) ||
        getSavedShooterNicknameValue() ||
        ''
      ).trim();
      const wave = Math.max(1, parseInt(options.wave != null ? options.wave : (metadata && metadata.wave), 10) || 1);
      return { nickname, wave };
    }

    async function loadHtml2CanvasInto(doc, win) {
      if (!doc || !win) throw new Error('Screenshot target is not ready.');
      if (typeof win.html2canvas === 'function') return win.html2canvas;
      const existing = doc.querySelector('script[data-html2canvas-loader="true"]');
      if (existing) {
        await new Promise((resolve, reject) => {
          if (typeof win.html2canvas === 'function') return resolve();
          existing.addEventListener('load', () => resolve(), { once: true });
          existing.addEventListener('error', () => reject(new Error('Unable to load screenshot renderer.')), { once: true });
        });
        if (typeof win.html2canvas === 'function') return win.html2canvas;
      }
      await new Promise((resolve, reject) => {
        const script = doc.createElement('script');
        script.src = 'https://cdn.jsdelivr.net/npm/html2canvas@1.4.1/dist/html2canvas.min.js';
        script.async = true;
        script.dataset.html2canvasLoader = 'true';
        script.onload = () => resolve();
        script.onerror = () => reject(new Error('Unable to load screenshot renderer.'));
        (doc.head || doc.documentElement || doc.body).appendChild(script);
      });
      if (typeof win.html2canvas !== 'function') throw new Error('Screenshot renderer did not initialize.');
      return win.html2canvas;
    }

    function waitForImagesInDocument(doc) {
      if (!doc) return Promise.resolve();
      return Promise.all(Array.from(doc.images || []).map((img) => {
        if (img.complete && img.naturalWidth > 0) return Promise.resolve();
        return new Promise((resolve) => {
          const done = () => resolve();
          img.addEventListener('load', done, { once: true });
          img.addEventListener('error', done, { once: true });
        });
      }));
    }

    async function renderShooterHostCanvas() {
      const html2canvas = await loadHtml2CanvasInto(document, window);
      await waitForImagesInDocument(document);
      const width = Math.max(1, Math.round(window.innerWidth || document.documentElement.clientWidth || 1));
      const height = Math.max(1, Math.round(window.innerHeight || document.documentElement.clientHeight || 1));
      return html2canvas(document.documentElement, {
        backgroundColor: window.getComputedStyle(document.body).backgroundColor || '#000',
        useCORS: true,
        allowTaint: true,
        logging: false,
        scale: 1,
        width,
        height,
        scrollX: 0,
        scrollY: 0,
        windowWidth: width,
        windowHeight: height,
        ignoreElements: (el) => el && (el.id === 'tektite-frame' || el.id === 'chat-sandbox-frame')
      });
    }

    async function renderShooterLevelFrameCanvas() {
      if (!tektiteFrame || !tektiteFrame.contentWindow) throw new Error('Shooter level frame is not ready.');
      const frameWindow = tektiteFrame.contentWindow;
      const frameDoc = frameWindow.document;
      const frameRect = tektiteFrame.getBoundingClientRect();
      const rawFrameWidth = Math.max(1, tektiteFrame.clientWidth || Math.round(frameRect.width));
      const rawFrameHeight = Math.max(1, tektiteFrame.clientHeight || Math.round(frameRect.height));
      if (!frameDoc || !frameDoc.documentElement || rawFrameWidth <= 0 || rawFrameHeight <= 0) throw new Error('Shooter level frame has no visible size.');
      try {
        const html2canvas = await loadHtml2CanvasInto(frameDoc, frameWindow);
        await waitForImagesInDocument(frameDoc);
        return await html2canvas(frameDoc.documentElement, {
          backgroundColor: frameWindow.getComputedStyle(frameDoc.body).backgroundColor || '#000',
          useCORS: true,
          allowTaint: true,
          logging: false,
          scale: 1,
          x: Math.max(0, Math.round(frameWindow.scrollX || 0)),
          y: Math.max(0, Math.round(frameWindow.scrollY || 0)),
          width: rawFrameWidth,
          height: rawFrameHeight,
          scrollX: 0,
          scrollY: 0,
          windowWidth: Math.max(rawFrameWidth, frameDoc.documentElement.scrollWidth || rawFrameWidth),
          windowHeight: Math.max(rawFrameHeight, frameDoc.documentElement.scrollHeight || rawFrameHeight)
        });
      } catch (error) {
        if (typeof frameWindow.tektiteCreateLevelScreenshotDataUrl !== 'function') throw error;
        const dataUrl = await frameWindow.tektiteCreateLevelScreenshotDataUrl({
          canvas: frameDoc.getElementById('game'),
          type: 'image/jpeg',
          quality: 0.88
        });
        const image = new Image();
        await new Promise((resolve, reject) => {
          image.onload = () => resolve();
          image.onerror = () => reject(error);
          image.src = dataUrl;
        });
        const canvas = document.createElement('canvas');
        canvas.width = rawFrameWidth;
        canvas.height = rawFrameHeight;
        const context = canvas.getContext('2d', { alpha: false });
        context.drawImage(image, 0, 0, rawFrameWidth, rawFrameHeight);
        return canvas;
      }
    }

    async function createShooterPageScreenshotDataUrl() {
      const [hostCanvas, levelCanvas] = await Promise.all([renderShooterHostCanvas(), renderShooterLevelFrameCanvas()]);
      const width = Math.max(1, Math.round(window.innerWidth || document.documentElement.clientWidth || 1));
      const height = Math.max(1, Math.round(window.innerHeight || document.documentElement.clientHeight || 1));
      const frameRect = tektiteFrame.getBoundingClientRect();
      const outputCanvas = document.createElement('canvas');
      outputCanvas.width = width;
      outputCanvas.height = height;
      const context = outputCanvas.getContext('2d', { alpha: false });
      if (!context) throw new Error('Unable to create screenshot canvas.');
      context.fillStyle = window.getComputedStyle(document.body).backgroundColor || '#000';
      context.fillRect(0, 0, width, height);
      context.drawImage(hostCanvas, 0, 0, hostCanvas.width, hostCanvas.height, 0, 0, width, height);
      context.drawImage(levelCanvas, 0, 0, levelCanvas.width, levelCanvas.height, Math.round(frameRect.left), Math.round(frameRect.top), Math.round(frameRect.width), Math.round(frameRect.height));
      return outputCanvas.toDataURL('image/jpeg', 0.88);
    }

    function notifyLevelSavedImagesUpdated(payload = {}) {
      try {
        if (tektiteFrame && tektiteFrame.contentWindow) {
          tektiteFrame.contentWindow.postMessage({
            type: 'tektite:saved-images-updated',
            ok: payload.ok !== false,
            message: payload.message || ''
          }, '*');
        }
      } catch (error) {}
    }

    async function saveShooterPageScreenshotToStorage(dataUrl, options = {}) {
      if (!dataUrl) return { ok: false, message: 'Unable to save screenshot.' };
      const metadata = getShooterSavedImageMetadata(options);
      if (!metadata.nickname) {
        notifyLevelSavedImagesUpdated({ ok: false, message: 'Please set a nickname to save images.' });
        return { ok: false, message: 'Please set a nickname to save images.' };
      }
      if (!window.tektiteShooterSavedImageStorage) {
        notifyLevelSavedImagesUpdated({ ok: false, message: 'Folder saving is not supported in this browser.' });
        return { ok: false, message: 'Folder saving is not supported in this browser.' };
      }
      const blob = await fetch(dataUrl).then((response) => response.blob());
      const result = await window.tektiteShooterSavedImageStorage.saveImageBlobToFolder({
        blob,
        nickname: metadata.nickname,
        wave: metadata.wave
      });
      notifyLevelSavedImagesUpdated({ ok: result.ok, message: result.ok ? 'Screenshot saved to chosen folder.' : String(result.message || 'Could not save screenshot.') });
      return { ok: !!result.ok, message: result.ok ? 'Screenshot saved to chosen folder.' : String(result.message || 'Could not save screenshot.') };
    }

    async function saveShooterPageScreenshot(options = {}) {
      try {
        const dataUrl = await createShooterPageScreenshotDataUrl();
        return await saveShooterPageScreenshotToStorage(dataUrl, options);
      } catch (error) {
        console.error('Shooter page screenshot failed:', error);
        notifyLevelSavedImagesUpdated({ ok: false, message: 'Unable to save screenshot.' });
        return { ok: false, message: 'Unable to save screenshot.' };
      }
    }

    function setChatFrameVisible(visible) {
      chatSandboxVisible = !!visible;
      chatSandboxFrame.classList.toggle('visible', chatSandboxVisible);
      notifyChildChatVisibility();
    }

    function getChatDocument() {
      try {
        const chatWindow = getChatWindow();
        return chatWindow && chatWindow.document ? chatWindow.document : null;
      } catch (error) {
        return null;
      }
    }

    function applyDebugClassToDocument(doc, enabled) {
      try {
        if (!doc || !doc.body) return;
        doc.body.classList.toggle('debug', !!enabled);
        doc.documentElement.classList.toggle('debug', !!enabled);
      } catch (error) {}
    }

    function notifyLevelDebugMode(enabled) {
      try {
        if (tektiteFrame && tektiteFrame.contentWindow) {
          tektiteFrame.contentWindow.postMessage({
            type: 'tektite:debug-mode',
            enabled: !!enabled
          }, '*');
        }
      } catch (error) {}
    }

    function applyShooterDebugMode(enabled) {
      shooterDebugMode = !!enabled;
      window.__shooterDebugMode = shooterDebugMode;
      document.body.classList.toggle('debug', shooterDebugMode);
      document.documentElement.classList.toggle('debug', shooterDebugMode);
      applyDebugClassToDocument(getChatDocument(), shooterDebugMode);
      try {
        const levelDoc = tektiteFrame && tektiteFrame.contentWindow && tektiteFrame.contentWindow.document;
        applyDebugClassToDocument(levelDoc, shooterDebugMode);
      } catch (error) {}
      notifyLevelDebugMode(shooterDebugMode);
    }

    function toggleShooterDebugMode() {
      applyShooterDebugMode(!shooterDebugMode);
      return shooterDebugMode;
    }

    function getChatInput() {
      try {
        const chatDoc = getChatDocument();
        if (!chatDoc) return null;
        return chatDoc.getElementById('chatBar');
      } catch (error) {
        return null;
      }
    }

    function canScrollChatNode(node) {
      if (!node || typeof node.scrollTop !== 'number') return false;
      const maxScrollTop = Math.max(0, (node.scrollHeight || 0) - (node.clientHeight || 0));
      if (maxScrollTop <= 0) return false;
      const style = node.ownerDocument && node.ownerDocument.defaultView ? node.ownerDocument.defaultView.getComputedStyle(node) : null;
      if (!style) return true;
      return style.overflowY !== 'hidden' && style.overflow !== 'hidden';
    }

    function getChatScrollTarget() {
      const chatDoc = getChatDocument();
      if (!chatDoc) return null;
      const visited = new Set();
      const addCandidate = (node, collection) => {
        if (!node || visited.has(node)) return;
        visited.add(node);
        collection.push(node);
      };
      const active = chatDoc.activeElement && chatDoc.activeElement !== chatDoc.body ? chatDoc.activeElement : null;
      const controllerTargets = getChatInteractiveTargets();
      const selectedTarget = chatControllerTargetIndex >= 0 && chatControllerTargetIndex < controllerTargets.length
        ? controllerTargets[chatControllerTargetIndex]
        : null;
      const candidates = [];

      [active, selectedTarget, getChatInput()].forEach((node) => {
        let current = node;
        while (current && current !== chatDoc.body) {
          addCandidate(current, candidates);
          current = current.parentElement;
        }
      });

      const messagesWrap = chatDoc.getElementById('messagesWrap');
      addCandidate(messagesWrap, candidates);

      return candidates.find((node) => canScrollChatNode(node)) || null;
    }

    function scrollChatBy(delta) {
      const amount = Number(delta) || 0;
      if (!amount) return false;
      const target = getChatScrollTarget();
      if (!target) return false;
      const previous = target.scrollTop;
      const maxScrollTop = Math.max(0, (target.scrollHeight || 0) - (target.clientHeight || 0));
      target.scrollTop = Math.max(0, Math.min(maxScrollTop, previous + amount));
      return target.scrollTop !== previous;
    }

    function isVisibleChatTarget(node) {
      if (!node) return false;
      const style = node.ownerDocument && node.ownerDocument.defaultView ? node.ownerDocument.defaultView.getComputedStyle(node) : null;
      const hidden = style && (style.display === 'none' || style.visibility === 'hidden');
      const rect = typeof node.getBoundingClientRect === 'function' ? node.getBoundingClientRect() : null;
      return !hidden && !node.disabled && !node.hasAttribute('disabled') && !node.hasAttribute('aria-hidden') && (!rect || (rect.width > 0 && rect.height > 0)) && (!style || style.pointerEvents !== 'none');
    }

    function getChatPromptTarget() {
      const chatDoc = getChatDocument();
      if (!chatDoc) return null;
      const chatInput = getChatInput();
      if (chatInput && isVisibleChatTarget(chatInput)) return chatInput;
      const selectors = [
        '[data-chat-prompt]',
        '#chatPromptButton',
        '#chatPrompt',
        '.chat-prompt',
        '.chat-input-prompt',
        '.chat-open-prompt',
        '.chat-launcher'
      ];
      for (const selector of selectors) {
        const node = chatDoc.querySelector(selector);
        if (node && isVisibleChatTarget(node)) return node;
      }
      const textMatch = Array.from(chatDoc.querySelectorAll('button, [role="button"], a, div, span')).find((node) => {
        const text = String(node.textContent || '').trim().toLowerCase();
        return text.includes('press here to chat') || text.includes('/ for commands');
      });
      return textMatch && isVisibleChatTarget(textMatch) ? textMatch : null;
    }

    function getChatCloseTarget() {
      const chatDoc = getChatDocument();
      if (!chatDoc) return null;
      const selectors = [
        '#chatCloseBtn',
        '#closeChatBtn',
        '.chat-close-btn',
        '.chat-close',
        '[data-chat-close]',
        '[aria-label="Close chat"]',
        '[aria-label="Close"]'
      ];
      for (const selector of selectors) {
        const node = chatDoc.querySelector(selector);
        if (node && isVisibleChatTarget(node)) return node;
      }
      const textMatch = Array.from(chatDoc.querySelectorAll('button, [role="button"], a')).find((node) => {
        const text = String(node.textContent || '').trim().toLowerCase();
        return text in {'x':1, '×':1, 'close':1};
      });
      return textMatch && isVisibleChatTarget(textMatch) ? textMatch : null;
    }

    function getChatHelpCommandTargets() {
      const chatDoc = getChatDocument();
      if (!chatDoc) return [];
      const preferredSelectors = [
        '[data-command]',
        '[data-cmd]',
        '.help-link',
        '.command-link',
        '.chat-command-link'
      ];
      const fallbackSelectors = [
        'a[href]',
        'button',
        '[role="button"]'
      ];
      const allSelectors = preferredSelectors.concat(fallbackSelectors);
      const nodes = Array.from(chatDoc.querySelectorAll(allSelectors.join(',')));
      const filtered = nodes.filter((node) => isVisibleChatTarget(node));
      const preferred = filtered.filter((node) => node.matches(preferredSelectors.join(',')));
      return preferred.length ? preferred : filtered;
    }

    function getChatInteractiveTargets() {
      const promptTarget = getChatPromptTarget();
      const closeTarget = getChatCloseTarget();
      const helpTargets = getChatHelpCommandTargets().filter((node) => node !== promptTarget && node !== closeTarget);
      const ordered = [];
      if (promptTarget) ordered.push(promptTarget);
      if (closeTarget) ordered.push(closeTarget);
      helpTargets.forEach((node) => {
        if (!ordered.includes(node)) ordered.push(node);
      });
      return ordered;
    }

    function rememberChatControllerBaseStyles(node) {
      if (!node) return;
      if (!node.hasAttribute('data-tektite-controller-base-bg')) node.dataset.tektiteControllerBaseBg = node.style.backgroundColor || '';
      if (!node.hasAttribute('data-tektite-controller-base-outline')) node.dataset.tektiteControllerBaseOutline = node.style.outline || '';
      if (!node.hasAttribute('data-tektite-controller-base-box-shadow')) node.dataset.tektiteControllerBaseBoxShadow = node.style.boxShadow || '';
      if (!node.hasAttribute('data-tektite-controller-base-border-radius')) node.dataset.tektiteControllerBaseBorderRadius = node.style.borderRadius || '';
      if (!node.hasAttribute('data-tektite-controller-base-color')) node.dataset.tektiteControllerBaseColor = node.style.color || '';
      if (!node.hasAttribute('data-tektite-controller-base-filter')) node.dataset.tektiteControllerBaseFilter = node.style.filter || '';
      if (!node.hasAttribute('data-tektite-controller-base-transform')) node.dataset.tektiteControllerBaseTransform = node.style.transform || '';
    }

    function updateChatControllerSelectionVisuals(selectedNode) {
      const chatDoc = getChatDocument();
      const targets = getChatInteractiveTargets();
      const previouslyTouched = chatDoc
        ? Array.from(chatDoc.querySelectorAll('[data-tektite-controller-selected], [data-tektite-controller-base-bg], [data-tektite-controller-base-outline]'))
        : [];
      const uniqueNodes = Array.from(new Set(previouslyTouched.concat(targets)));
      uniqueNodes.forEach((node) => {
        if (!node) return;
        rememberChatControllerBaseStyles(node);
        const isSelected = node === selectedNode;
        if (isSelected) {
          node.dataset.tektiteControllerSelected = 'true';
          try { node.classList.add('controllerFocus'); } catch (error) {}
          node.style.backgroundColor = 'rgba(81,42,103,0.82)';
          node.style.outline = '2px solid rgba(0,255,102,0.98)';
          node.style.boxShadow = '0 0 0 1px rgba(0,255,102,0.35), 0 0 14px rgba(0,255,102,0.28)';
          node.style.borderRadius = node.dataset.tektiteControllerBaseBorderRadius || '10px';
          node.style.color = '#ffffff';
          node.style.filter = 'brightness(1.08)';
          node.style.transform = 'translateX(0)';
        } else {
          node.dataset.tektiteControllerSelected = 'false';
          try { node.classList.remove('controllerFocus'); } catch (error) {}
          node.style.backgroundColor = node.dataset.tektiteControllerBaseBg || '';
          node.style.outline = node.dataset.tektiteControllerBaseOutline || '';
          node.style.boxShadow = node.dataset.tektiteControllerBaseBoxShadow || '';
          node.style.borderRadius = node.dataset.tektiteControllerBaseBorderRadius || '';
          node.style.color = node.dataset.tektiteControllerBaseColor || '';
          node.style.filter = node.dataset.tektiteControllerBaseFilter || '';
          node.style.transform = node.dataset.tektiteControllerBaseTransform || '';
        }
      });
    }

    function syncChatControllerTargetIndex(targets) {
      if (!targets.length) {
        chatControllerTargetIndex = -1;
        return -1;
      }
      const chatDoc = getChatDocument();
      const active = chatDoc && chatDoc.activeElement ? chatDoc.activeElement : null;
      let index = targets.findIndex((node) => node === active);
      if (index < 0) {
        index = targets.findIndex((node) => active && typeof node.contains === 'function' && node.contains(active));
      }
      if (index >= 0) {
        chatControllerTargetIndex = index;
        return index;
      }
      if (chatControllerTargetIndex < 0 || chatControllerTargetIndex >= targets.length) {
        chatControllerTargetIndex = 0;
      }
      return chatControllerTargetIndex;
    }

    function focusChatTargetByIndex(index) {
      const targets = getChatInteractiveTargets();
      if (!targets.length) {
        updateChatControllerSelectionVisuals(null);
        return false;
      }
      if (typeof index !== 'number' || Number.isNaN(index)) index = 0;
      chatControllerTargetIndex = ((index % targets.length) + targets.length) % targets.length;
      const next = targets[chatControllerTargetIndex];
      if (!next) {
        updateChatControllerSelectionVisuals(null);
        return false;
      }
      try { next.setAttribute('tabindex', next.getAttribute('tabindex') || '0'); } catch (error) {}
      updateChatControllerSelectionVisuals(next);
      try { next.focus({ preventScroll: false }); } catch (error) { try { next.focus(); } catch (_) {} }
      try { next.scrollIntoView({ block: 'nearest', inline: 'nearest' }); } catch (error) {}
      return true;
    }

    function focusChatTargetByStep(step) {
      const targets = getChatInteractiveTargets();
      if (!targets.length) return false;
      const currentIndex = syncChatControllerTargetIndex(targets);
      const nextIndex = currentIndex < 0 ? (step > 0 ? 0 : targets.length - 1) : (currentIndex + step + targets.length) % targets.length;
      return focusChatTargetByIndex(nextIndex);
    }

    function focusFirstChatInteractiveTarget() {
      return focusChatTargetByIndex(0);
    }

    function focusChatPromptTarget() {
      const promptTarget = getChatPromptTarget();
      if (!promptTarget) return focusFirstChatInteractiveTarget();
      const targets = getChatInteractiveTargets();
      const index = targets.findIndex((node) => node === promptTarget);
      return focusChatTargetByIndex(index >= 0 ? index : 0);
    }

    function moveChatControllerSelection(direction) {
      const targets = getChatInteractiveTargets();
      if (!targets.length) return false;
      const currentIndex = syncChatControllerTargetIndex(targets);
      const promptTarget = getChatPromptTarget();
      const closeTarget = getChatCloseTarget();
      const helpTargets = targets.filter((node) => node !== promptTarget && node !== closeTarget);
      const current = currentIndex >= 0 ? targets[currentIndex] : null;

      if (direction === 'up') {
        if (current === promptTarget && helpTargets.length) return focusChatTargetByIndex(targets.findIndex((node) => node === helpTargets[helpTargets.length - 1]));
        if (current === closeTarget && helpTargets.length) return focusChatTargetByIndex(targets.findIndex((node) => node === helpTargets[helpTargets.length - 1]));
        if (current && helpTargets.includes(current)) {
          const helpIndex = helpTargets.indexOf(current);
          if (helpIndex > 0) return focusChatTargetByIndex(targets.findIndex((node) => node === helpTargets[helpIndex - 1]));
          if (helpIndex === 0 && promptTarget) return focusChatTargetByIndex(targets.findIndex((node) => node === promptTarget));
        }
        return focusChatPromptTarget();
      }
      if (direction === 'down') {
        if (current === promptTarget) return closeTarget ? focusChatTargetByIndex(targets.findIndex((node) => node === closeTarget)) : focusChatPromptTarget();
        if (current === closeTarget) {
          if (helpTargets.length) return focusChatTargetByIndex(targets.findIndex((node) => node === helpTargets[0]));
          return promptTarget ? focusChatTargetByIndex(targets.findIndex((node) => node === promptTarget)) : focusChatPromptTarget();
        }
        if (current && helpTargets.includes(current)) {
          const helpIndex = helpTargets.indexOf(current);
          if (helpIndex < helpTargets.length - 1) return focusChatTargetByIndex(targets.findIndex((node) => node === helpTargets[helpIndex + 1]));
          if (helpIndex === helpTargets.length - 1 && promptTarget) return focusChatTargetByIndex(targets.findIndex((node) => node === promptTarget));
        }
        return focusChatPromptTarget();
      }
      if (direction === 'right') {
        if (current === promptTarget && closeTarget) return focusChatTargetByIndex(targets.findIndex((node) => node === closeTarget));
        return current ? focusChatTargetByIndex(currentIndex) : focusChatPromptTarget();
      }
      if (direction === 'left') {
        if (current === closeTarget && promptTarget) return focusChatTargetByIndex(targets.findIndex((node) => node === promptTarget));
        return promptTarget ? focusChatTargetByIndex(targets.findIndex((node) => node === promptTarget)) : focusFirstChatInteractiveTarget();
      }
      return false;
    }

    function hasActiveChatValuePicker() {
      const chatDoc = getChatDocument();
      if (!chatDoc) return false;
      return !!chatDoc.querySelector('.helpItem[data-number-picker-active="true"], .helpItem[data-color-picker-active="true"], .helpItem[data-choice-picker-active="true"], .helpItem[data-text-picker-active="true"]');
    }


    function closeActiveChatValuePickerFromParent() {
      const chatDoc = getChatDocument();
      const activePickerItem = chatDoc
        ? chatDoc.querySelector('.helpItem[data-number-picker-active="true"], .helpItem[data-color-picker-active="true"], .helpItem[data-choice-picker-active="true"], .helpItem[data-text-picker-active="true"]')
        : null;
      postToChatSandbox({ type: 'chatSandboxCloseActiveCommandPicker' });
      if (activePickerItem) {
        const targets = getChatInteractiveTargets();
        const pickerIndex = targets.findIndex((node) => node === activePickerItem);
        if (pickerIndex >= 0) {
          chatControllerTargetIndex = pickerIndex;
          updateChatControllerSelectionVisuals(activePickerItem);
        }
      }
      chatValuePickerActive = false;
      chatValuePickerCommand = '';
      notifyChildChatVisibility();
      return true;
    }

    function activateFocusedChatTarget() {
      const targets = getChatInteractiveTargets();
      const activeIndex = syncChatControllerTargetIndex(targets);
      const target = activeIndex >= 0 ? targets[activeIndex] : null;
      const chatDoc = getChatDocument();
      const active = target || (chatDoc && chatDoc.activeElement ? chatDoc.activeElement : null);
      if (active && chatDoc && active !== chatDoc.body) {
        const command = active.dataset && typeof active.dataset.command === 'string' ? active.dataset.command.trim() : '';
        if (command && getChatWindow()) {
          postToChatSandbox({
            type: 'chatSandboxActivateHelpCommand',
            command
          });
          return true;
        }
        try {
          const view = (active.ownerDocument && active.ownerDocument.defaultView) || window;
          active.dispatchEvent(new view.MouseEvent('pointerdown', { bubbles: true, cancelable: true }));
          active.dispatchEvent(new view.MouseEvent('mousedown', { bubbles: true, cancelable: true }));
          active.dispatchEvent(new view.MouseEvent('mouseup', { bubbles: true, cancelable: true }));
          active.click();
          return true;
        } catch (error) {}
        try {
          const view = (active.ownerDocument && active.ownerDocument.defaultView) || window;
          active.dispatchEvent(new view.KeyboardEvent('keydown', { key: 'Enter', code: 'Enter', bubbles: true, cancelable: true }));
          active.dispatchEvent(new view.KeyboardEvent('keyup', { key: 'Enter', code: 'Enter', bubbles: true, cancelable: true }));
          return true;
        } catch (error) {}
      }
      return dispatchChatKey('Enter', 'Enter');
    }

    function setChatInputValue(input, value) {
      if (!input) return false;
      try {
        const proto = input.ownerDocument && input.ownerDocument.defaultView
          ? input.ownerDocument.defaultView.HTMLInputElement.prototype
          : HTMLInputElement.prototype;
        const descriptor = Object.getOwnPropertyDescriptor(proto, 'value');
        if (descriptor && typeof descriptor.set === 'function') {
          descriptor.set.call(input, value);
        } else {
          input.value = value;
        }
        input.dispatchEvent(new Event('input', { bubbles: true }));
        input.dispatchEvent(new Event('keyup', { bubbles: true }));
        return true;
      } catch (error) {
        try {
          input.value = value;
          input.dispatchEvent(new Event('input', { bubbles: true }));
          input.dispatchEvent(new Event('keyup', { bubbles: true }));
          return true;
        } catch (_) {
          return false;
        }
      }
    }

    function dispatchChatKey(key, code, options = {}) {
      const chatDoc = getChatDocument();
      const input = getChatInput();
      const target = options.target === 'active' && chatDoc && chatDoc.activeElement && chatDoc.activeElement !== chatDoc.body
        ? chatDoc.activeElement
        : input;
      if (!target) return false;
      try {
        if (typeof target.focus === 'function') target.focus();
        const view = (target.ownerDocument && target.ownerDocument.defaultView) || window;
        const event = new view.KeyboardEvent('keydown', {
          key,
          code: code || key,
          bubbles: true,
          cancelable: true,
          shiftKey: !!options.shiftKey
        });
        target.dispatchEvent(event);
        return true;
      } catch (error) {
        return false;
      }
    }

    function runChatCommand(command) {
      const normalizedCommand = String(command || '').trim();
      if (!normalizedCommand || !chatSandboxReady || !getChatWindow()) return false;
      chatControllerTargetIndex = -1;
      postToChatSandbox({
        type: 'chatSandboxExecuteCommand',
        command: normalizedCommand,
        openChat: true,
        focus: true
      });
      return true;
    }

    function primeChatSlashSuggestion() {
      const input = getChatInput();
      if (!input) return false;
      try {
        input.focus();
        input.click();
      } catch (error) {}
      if (!setChatInputValue(input, '/')) return false;
      dispatchChatKey('ArrowDown', 'ArrowDown');
      return true;
    }

    function withChatInputReady(callback, attempt = 0) {
      if (callback()) return;
      if (attempt >= 12) return;
      window.setTimeout(() => withChatInputReady(callback, attempt + 1), 35);
    }

    function flushPendingChatOpen() {
      if (!pendingChatOpenOptions || !chatSandboxReady) return;
      const options = pendingChatOpenOptions;
      pendingChatOpenOptions = null;
      postToChatSandbox({
        type: 'chatSandboxOpen',
        focus: options.focus !== false,
        seedSlash: !!options.seedSlash
      });
      if (options.runCommand) {
        withChatInputReady(() => runChatCommand(options.runCommand));
      } else if (options.autoSuggestSlash) {
        withChatInputReady(primeChatSlashSuggestion);
      }
    }

    function openChatFromParent(options = {}) {
      chatControllerTargetIndex = -1;
      try {
        if (tektiteFrame && tektiteFrame.contentWindow) {
          tektiteFrame.contentWindow.postMessage({
            type: 'tektite:pause-for-chat'
          }, '*');
        }
      } catch (error) {}
      setChatFrameVisible(true);
      pendingChatOpenOptions = {
        focus: options.focus !== false,
        seedSlash: !!options.seedSlash,
        autoSuggestSlash: !!options.autoSuggestSlash,
        runCommand: options.runCommand ? String(options.runCommand).trim() : ''
      };
      flushPendingChatOpen();
    }

    function closeChatFromParent() {
      chatControllerTargetIndex = -1;
      updateChatControllerSelectionVisuals(null);
      postToChatSandbox({ type: 'chatSandboxClose' });
      setChatFrameVisible(false);
      try { tektiteFrame.contentWindow.focus(); } catch (error) {}
    }

    function getVisibleShooterPageCommands() {
      return shooterPageCommands
        .filter((command) => {
          if (shooterCheatsUnlocked) return command.unlockOnly !== true;
          return command.cheatOnly !== true;
        })
        .map((command) => ({
          ...command,
          suggestions: command.name === '/nickname'
            ? getSavedShooterNicknameSuggestions()
            : (Array.isArray(command.suggestions) ? command.suggestions.slice() : [])
        }));
    }

    function registerPageCommands() {
      postToChatSandbox({
        type: 'pageChatRegister',
        commands: getVisibleShooterPageCommands(),
        pageOnly: true,
        pageId: hasSwitchedToLevel2 ? 'shooter-game-level2' : 'shooter-game-level1',
        title: 'Tektite Shooter',
        sourceKey: 'shooter-game',
        cheatsUnlocked: shooterCheatsUnlocked,
        inputMode: shooterActiveInputMode,
        welcomeMessage: "System: Welcome to Tektite's Shooter Game..."
      });
    }


    function deleteIndexedDatabaseByName(name) {
      return new Promise((resolve) => {
        try {
          if (!window.indexedDB || !name) return resolve(false);
          const request = window.indexedDB.deleteDatabase(name);
          request.onsuccess = () => resolve(true);
          request.onerror = () => resolve(false);
          request.onblocked = () => resolve(false);
        } catch (error) {
          resolve(false);
        }
      });
    }

    async function clearAllShooterSiteDataForFirstVisit() {
      // Hidden /reset: wipe browser-side site state while only severing saved-image folder links.
      // Do not delete actual files from the chosen folder.
      try {
        if (window.tektiteShooterSavedImageStorage && typeof window.tektiteShooterSavedImageStorage.forgetSavedImageFolderConnections === 'function') {
          await window.tektiteShooterSavedImageStorage.forgetSavedImageFolderConnections();
        }
      } catch (error) {}

      try { window.localStorage.clear(); } catch (error) {}
      try { window.sessionStorage.clear(); } catch (error) {}

      try {
        if (window.indexedDB && typeof window.indexedDB.databases === 'function') {
          const databases = await window.indexedDB.databases();
          await Promise.all((databases || [])
            .map((db) => db && db.name)
            .filter(Boolean)
            .map(deleteIndexedDatabaseByName));
        } else {
          await deleteIndexedDatabaseByName('tektiteShooterSavedImagesFS');
        }
      } catch (error) {
        try { await deleteIndexedDatabaseByName('tektiteShooterSavedImagesFS'); } catch (_) {}
      }

      try {
        if (window.caches && typeof window.caches.keys === 'function') {
          const keys = await window.caches.keys();
          await Promise.all((keys || []).map((key) => window.caches.delete(key)));
        }
      } catch (error) {}

      try {
        document.cookie.split(';').forEach((cookie) => {
          const eq = cookie.indexOf('=');
          const name = (eq > -1 ? cookie.slice(0, eq) : cookie).trim();
          if (!name) return;
          document.cookie = `${name}=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/`;
        });
      } catch (error) {}

      try {
        if (navigator.serviceWorker && typeof navigator.serviceWorker.getRegistrations === 'function') {
          const registrations = await navigator.serviceWorker.getRegistrations();
          await Promise.all((registrations || []).map((registration) => registration.unregister()));
        }
      } catch (error) {}
    }

    function runHiddenResetCommandFromHost() {
      clearAllShooterSiteDataForFirstVisit().finally(() => {
        window.setTimeout(() => {
          try {
            const cleanUrl = String(window.location.href || '').split('#')[0];
            window.location.replace(cleanUrl);
          } catch (error) {
            try { window.location.reload(); } catch (_) {}
          }
        }, 250);
      });
      return '/reset wiped browser site data and severed saved-image folder connections. Reloading as a first visit.';
    }

    async function setIframeFullscreen(shouldEnter) {
      const fullscreenTarget = document.documentElement || document.body || tektiteFrame;
      if (!fullscreenTarget) return;
      try {
        const fsElement = document.fullscreenElement;
        if (shouldEnter) {
          if (fsElement !== fullscreenTarget && fullscreenTarget.requestFullscreen) {
            await fullscreenTarget.requestFullscreen();
          }
        } else if (fsElement && document.exitFullscreen) {
          await document.exitFullscreen();
        }
      } catch (error) {
        console.warn('Fullscreen request failed.', error);
      } finally {
        notifyChildFullscreenState();
      }
    }

    function stopShooterLevelFramesFor404() {
      hasSwitchedToLevel2 = false;
      forceGameLoopFailureBackground();
      const levelFrames = Array.from(document.querySelectorAll('iframe')).filter((frame) => {
        const src = String(frame.getAttribute('src') || '');
        return frame.id === 'tektite-frame' || src.includes('shooter-game-level1.html') || src.includes('shooter-game-level2.html');
      });
      levelFrames.forEach((frame) => {
        frame.dataset.tektiteStoppedByCommand = 'true';
        frame.style.opacity = '0';
        frame.style.visibility = 'hidden';
        frame.style.pointerEvents = 'none';
        frame.removeAttribute('srcdoc');
        frame.setAttribute('src', 'about:blank');
      });
    }

    function startShooterLevel1FromCommand() {
      hasSwitchedToLevel2 = false;
      clearForcedGameLoopFailureBackground();
      if (!tektiteFrame) return;
      tektiteFrame.dataset.tektiteStoppedByCommand = 'false';
      tektiteFrame.style.opacity = '';
      tektiteFrame.style.visibility = '';
      tektiteFrame.style.pointerEvents = '';
      resetGameLoopWatch({ clearForced: true });
      tektiteFrame.src = `${LEVEL1_SRC}?reload=${Date.now()}`;
      registerPageCommands();
      try { tektiteFrame.focus(); } catch (error) {}
    }

    function switchToLevel2() {
      if (!tektiteFrame || hasSwitchedToLevel2) return;
      hasSwitchedToLevel2 = true;
      const keepFullscreen = !!document.fullscreenElement;
      resetGameLoopWatch({ clearForced: true });
        tektiteFrame.style.opacity = '';
        tektiteFrame.style.visibility = '';
        tektiteFrame.style.pointerEvents = '';
        tektiteFrame.src = buildLevel2Src();
      if (keepFullscreen) {
        tektiteFrame.addEventListener('load', () => {
          setIframeFullscreen(true);
        }, { once: true });
      }
    }

    function switchToLevel1Reloaded() {
      if (!tektiteFrame) return;
      hasSwitchedToLevel2 = false;
      const keepFullscreen = !!document.fullscreenElement;
      resetGameLoopWatch({ clearForced: true });
        tektiteFrame.style.opacity = '';
        tektiteFrame.style.visibility = '';
        tektiteFrame.style.pointerEvents = '';
        tektiteFrame.src = `${LEVEL1_SRC}?reload=${Date.now()}`;
      if (keepFullscreen) {
        tektiteFrame.addEventListener('load', () => {
          setIframeFullscreen(true);
        }, { once: true });
      }
    }

    function shouldIgnoreChatShortcutFromEvent(event) {
      const view = event.view || window;
      const doc = view.document || document;
      const activeElement = doc.activeElement;
      const activeTag = activeElement && activeElement.tagName ? activeElement.tagName.toUpperCase() : '';
      return !!(activeElement && (
        activeTag === 'INPUT' ||
        activeTag === 'TEXTAREA' ||
        activeTag === 'SELECT' ||
        activeElement.isContentEditable
      ));
    }

    function handleChatShortcutKeydown(event) {
      if (event.key === '/' && !event.ctrlKey && !event.metaKey && !event.altKey) {
        if (shouldIgnoreChatShortcutFromEvent(event)) return;
        event.preventDefault();
        event.stopPropagation();
        openChatFromParent({ focus: true, runCommand: '/help' });
        return;
      }

      if (event.key === 'Escape' && chatSandboxVisible) {
        event.preventDefault();
        event.stopPropagation();
        closeChatFromParent();
      }
    }

    function bindChatShortcutToFrame(frame) {
      try {
        const frameWindow = frame && frame.contentWindow;
        const frameDoc = frameWindow && frameWindow.document;
        if (!frameWindow || !frameDoc || frameWindow.__shooterChatShortcutBound) return;
        frameWindow.addEventListener('keydown', handleChatShortcutKeydown, true);
        frameDoc.addEventListener('keydown', handleChatShortcutKeydown, true);
        frameWindow.__shooterChatShortcutBound = true;
      } catch (error) {
        console.warn('Unable to bind chat shortcut to frame', error);
      }
    }

    window.addEventListener('keydown', handleChatShortcutKeydown, true);

    chatSandboxFrame.addEventListener('load', () => {
      chatSandboxReady = true;
      flushPendingChatOpen();
      registerPageCommands();
      postInputModeToChatSandbox();
      applyShooterDebugMode(shooterDebugMode);
      bindChatShortcutToFrame(chatSandboxFrame);
    });

    tektiteFrame.addEventListener('load', () => {
      bindChatShortcutToFrame(tektiteFrame);
      registerPageCommands();
      applyShooterDebugMode(shooterDebugMode);
      notifyChildFullscreenState();
    });

    document.addEventListener('fullscreenchange', notifyChildFullscreenState);

    window.addEventListener('message', async (event) => {
      const data = event.data;
      if (!data || typeof data !== 'object') return;

      if (event.source === getChatWindow()) {
        if (data.type === 'chatSandboxState') {
          chatSandboxReady = true;
          chatValuePickerActive = !!data.valuePickerActive;
          chatValuePickerCommand = chatValuePickerActive ? String(data.valuePickerCommand || '').trim().toLowerCase() : '';
          flushPendingChatOpen();
          setChatFrameVisible(!!data.visible);
          return;
        }
        if (data.type === 'pageChatExecute') {
          const rawCommand = String(data.raw || data.command || '').trim();
          const commandName = String(data.command || '').trim().toLowerCase();
          if (commandName === '/reset') {
            const message = runHiddenResetCommandFromHost();
            postToChatSandbox({
              type: 'pageChatResult',
              command: '/reset',
              message,
              announce: true
            });
            return;
          }
          if (commandName === '/debug') {
            const enabled = toggleShooterDebugMode();
            postToChatSandbox({
              type: 'pageChatResult',
              command: '/debug',
              message: `/debug ${enabled ? 'enabled' : 'disabled'}.`,
              announce: true
            });
            return;
          }
          if (commandName === '/stop') {
            if (!shooterCheatsUnlocked) {
              postToChatSandbox({
                type: 'pageChatResult',
                command: '/stop',
                message: '/stop requires cheatermode to be active.',
                announce: true
              });
              return;
            }
            stopShooterLevelFramesFor404();
            postToChatSandbox({
              type: 'pageChatResult',
              command: '/stop',
              message: '/stop executed. Level iframe closed; 404 test background exposed.',
              announce: true
            });
            return;
          }
          if (commandName === '/start') {
            if (!shooterCheatsUnlocked) {
              postToChatSandbox({
                type: 'pageChatResult',
                command: '/start',
                message: '/start requires cheatermode to be active.',
                announce: true
              });
              return;
            }
            startShooterLevel1FromCommand();
            postToChatSandbox({
              type: 'pageChatResult',
              command: '/start',
              message: '/start executed. Level 1 loading normally.',
              announce: true
            });
            return;
          }
          if (commandName === '/screenshot') {
            const result = await saveShooterPageScreenshot();
            postToChatSandbox({
              type: 'pageChatResult',
              command: '/screenshot',
              message: result.message,
              announce: true
            });
            return;
          }
          if (commandName === '/nickname') {
            const nextNickname = rawCommand.slice('/nickname'.length).trim();
            postToChatSandbox({
              type: 'pageChatResult',
              command: '/nickname',
              message: nextNickname ? `/nickname executed by ${nextNickname}` : 'Usage: /nickname [name]',
              nickname: nextNickname || '',
              announce: true
            });
            window.setTimeout(() => registerPageCommands(), 0);
            return;
          }
          if (tektiteFrame && tektiteFrame.contentWindow) {
            tektiteFrame.contentWindow.postMessage({
              type: 'tektite:execute-command',
              command: rawCommand
            }, '*');
          }
          return;
        }
      }

      if (data.type === 'tektite:request-page-screenshot') {
        saveShooterPageScreenshot({
          nickname: data.nickname,
          wave: data.wave
        });
        return;
      }

      if (data.type === 'tektite:input-mode') {
        const nextMode = String(data.mode || '').trim() === 'controller' ? 'controller' : 'keyboardMouse';
        if (shooterActiveInputMode !== nextMode) {
          shooterActiveInputMode = nextMode;
          postInputModeToChatSandbox();
        }
        return;
      }

      if (data.type === 'tektite:cheats-unlocked-state') {
        shooterCheatsUnlocked = !!data.unlocked;
        registerPageCommands();
        return;
      }

      if (data.type === 'tektite:cheatermode-hold-state') {
        postCheatermodeHoldStateToChatSandbox(data);
        return;
      }

      if (data.type === 'tektite:continue-to-level2') {
        switchToLevel2();
        return;
      }
      if (data.type === 'tektite:return-to-level1') {
        switchToLevel1Reloaded();
        return;
      }
      if (data.type === 'tektite:fullscreen') {
        const action = data.action || 'toggle';
        if (action === 'enter') await setIframeFullscreen(true);
        else if (action === 'exit') await setIframeFullscreen(false);
        else await setIframeFullscreen(!document.fullscreenElement);
        return;
      }
      if (data.type === 'tektite:set-nickname') {
        const nextNickname = String(data.nickname || '').trim();
        postToChatSandbox({
          type: 'pageChatResult',
          command: '/nickname',
          message: nextNickname ? `/nickname executed by ${nextNickname}` : 'Nickname cleared.',
          nickname: nextNickname,
          announce: data.announce === true
        });
        window.setTimeout(() => registerPageCommands(), 0);
        return;
      }
      if (data.type === 'tektite:command-result') {
        postToChatSandbox({
          type: 'pageChatResult',
          command: data.command || '',
          message: data.message || `${data.command || 'Command'} executed`,
          announce: true
        });
        return;
      }
      if (data.type === 'openChatFromChild') {
        openChatFromParent({
          focus: true,
          seedSlash: !!data.seedSlash,
          autoSuggestSlash: !!data.autoSuggestSlash,
          runCommand: data.runCommand ? String(data.runCommand) : ''
        });
        return;
      }
      if (data.type === 'closeChatFromChild') {
        closeChatFromParent();
        return;
      }
      if (data.type === 'tektite:chat-control') {
        const action = String(data.action || '').trim();
        const valuePickerActive = hasActiveChatValuePicker();
        if (action === 'cycleUp') {
          if (valuePickerActive) dispatchChatKey('ArrowUp', 'ArrowUp', { target: 'active' });
          else if (!moveChatControllerSelection('up')) dispatchChatKey('ArrowUp', 'ArrowUp', { target: 'active' });
        } else if (action === 'cycleDown') {
          if (valuePickerActive) dispatchChatKey('ArrowDown', 'ArrowDown', { target: 'active' });
          else if (!moveChatControllerSelection('down')) dispatchChatKey('ArrowDown', 'ArrowDown', { target: 'active' });
        } else if (action === 'cycleLeft') {
          if (valuePickerActive) dispatchChatKey('ArrowLeft', 'ArrowLeft', { target: 'active' });
          else if (!moveChatControllerSelection('left')) dispatchChatKey('ArrowLeft', 'ArrowLeft', { target: 'active' });
        } else if (action === 'cycleRight') {
          if (valuePickerActive) dispatchChatKey('ArrowRight', 'ArrowRight', { target: 'active' });
          else if (!moveChatControllerSelection('right')) dispatchChatKey('ArrowRight', 'ArrowRight', { target: 'active' });
        } else if (action === 'execute') {
          activateFocusedChatTarget();
        } else if (action === 'seedSlash') {
          withChatInputReady(primeChatSlashSuggestion);
        } else if (action === 'close') {
          if (valuePickerActive) closeActiveChatValuePickerFromParent();
          else closeChatFromParent();
        } else if (action === 'scrollUp') {
          scrollChatBy(-72);
        } else if (action === 'scrollDown') {
          scrollChatBy(72);
        }
        chatValuePickerActive = hasActiveChatValuePicker();
        notifyChildChatVisibility();
        return;
      }
    });
  
