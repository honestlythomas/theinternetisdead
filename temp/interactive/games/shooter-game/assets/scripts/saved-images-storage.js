(function(){
  const DB_NAME = "tektiteShooterSavedImagesFS";
  const STORE_NAME = "handles";
  const DIRECTORY_KEY_PREFIX = "savedImagesDirectoryHandle:";
  const FILE_PREFIX = "tektite-shooter";
  let dbPromise = null;

  function supportsSavedImageFolders(){
    return typeof window !== "undefined" && "showDirectoryPicker" in window && "indexedDB" in window;
  }

  function normalizeNickname(value){
    return String(value || "").trim();
  }

  function getDirectoryKey(nickname){
    const normalized = normalizeNickname(nickname);
    return normalized ? `${DIRECTORY_KEY_PREFIX}${normalized.toLowerCase()}` : "";
  }

  function buildDirectoryName(nickname){
    const normalized = normalizeNickname(nickname);
    if (!normalized) return "";
    return normalized.replace(/[<>:"/\\|?*\u0000-\u001f]/g, "_").replace(/\.+$/g, "").trim() || "Saved Images";
  }

  function buildDirectoryLabel(parentName, childName){
    const parent = String(parentName || "").trim();
    const child = String(childName || "").trim();
    if (parent && child) return `${parent}/${child}/`;
    if (child) return `${child}/`;
    if (parent) return `${parent}/`;
    return "";
  }

  function normalizeStoredDirectoryRecord(value){
    if (!value) return null;
    if (value.kind === "directory" || typeof value.queryPermission === "function"){
      return {
        handle: value,
        directoryName: String(value.name || "").trim(),
        directoryLabel: String(value.name || "").trim()
      };
    }
    if (typeof value === "object"){
      const handle = value.handle || value.directoryHandle || null;
      if (!handle) return null;
      const directoryName = String(value.directoryName || handle.name || "").trim();
      const rawDirectoryLabel = String(value.directoryLabel || "").trim();
      const directoryLabel = rawDirectoryLabel
        ? rawDirectoryLabel.replace(/\\/g, "/").replace(/\/+$/, "") + "/"
        : buildDirectoryLabel("", directoryName);
      return {
        handle,
        directoryName,
        directoryLabel
      };
    }
    return null;
  }

  function openDatabase(){
    if (!supportsSavedImageFolders()) return Promise.resolve(null);
    if (dbPromise) return dbPromise;
    dbPromise = new Promise((resolve, reject) => {
      const request = window.indexedDB.open(DB_NAME, 1);
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(STORE_NAME)) db.createObjectStore(STORE_NAME);
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error || new Error("Unable to open saved images database."));
    }).catch(() => null);
    return dbPromise;
  }

  async function readHandle(key){
    const db = await openDatabase();
    if (!db) return null;
    return new Promise((resolve) => {
      const tx = db.transaction(STORE_NAME, "readonly");
      const store = tx.objectStore(STORE_NAME);
      const request = store.get(key);
      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => resolve(null);
    });
  }

  async function writeHandle(key, value){
    const db = await openDatabase();
    if (!db) return false;
    return new Promise((resolve) => {
      const tx = db.transaction(STORE_NAME, "readwrite");
      const store = tx.objectStore(STORE_NAME);
      const request = store.put(value, key);
      request.onsuccess = () => resolve(true);
      request.onerror = () => resolve(false);
    });
  }

  async function deleteHandle(key){
    const db = await openDatabase();
    if (!db) return false;
    return new Promise((resolve) => {
      const tx = db.transaction(STORE_NAME, "readwrite");
      const store = tx.objectStore(STORE_NAME);
      const request = store.delete(key);
      request.onsuccess = () => resolve(true);
      request.onerror = () => resolve(false);
    });
  }

  async function forgetSavedImageFolderConnections(){
    // Sever File System Access handles only. Do NOT delete user image files.
    const db = await openDatabase();
    if (!db) return false;
    return new Promise((resolve) => {
      const tx = db.transaction(STORE_NAME, "readwrite");
      const store = tx.objectStore(STORE_NAME);
      const request = store.clear();
      request.onsuccess = () => resolve(true);
      request.onerror = () => resolve(false);
    });
  }

  async function ensurePermission(handle, mode){
    if (!handle) return false;
    const options = { mode: mode || "read" };
    try{
      if (typeof handle.queryPermission === "function"){
        const current = await handle.queryPermission(options);
        if (current === "granted") return true;
      }
      if (typeof handle.requestPermission === "function"){
        const next = await handle.requestPermission(options);
        return next === "granted";
      }
      return true;
    }catch(error){
      return false;
    }
  }

  async function getSavedImagesDirectoryHandle(options = {}){
    const key = getDirectoryKey(options.nickname);
    if (!key) return null;
    const record = normalizeStoredDirectoryRecord(await readHandle(key));
    if (!record || !record.handle) return null;
    const permitted = await ensurePermission(record.handle, options.write ? "readwrite" : "read");
    if (!permitted && options.forgetOnFailure) await deleteHandle(key);
    return permitted ? record.handle : null;
  }

  async function getSavedImagesDirectoryRecord(options = {}){
    const key = getDirectoryKey(options.nickname);
    if (!key) return null;
    const record = normalizeStoredDirectoryRecord(await readHandle(key));
    if (!record || !record.handle) return null;
    const permitted = await ensurePermission(record.handle, options.write ? "readwrite" : "read");
    if (!permitted){
      if (options.forgetOnFailure) await deleteHandle(key);
      return null;
    }
    return record;
  }

  async function chooseSavedImagesDirectory(options = {}){
    const nickname = normalizeNickname(options.nickname);
    if (!nickname){
      return { ok: false, message: "Please set a nickname to save images." };
    }
    if (!supportsSavedImageFolders()){
      return { ok: false, message: "Folder saving is not supported in this browser." };
    }
    try{
      const parentHandle = await window.showDirectoryPicker({ mode: "readwrite" });
      const permitted = await ensurePermission(parentHandle, "readwrite");
      if (!permitted){
        return { ok: false, message: "Folder access was not granted." };
      }
      const directoryName = buildDirectoryName(nickname);
      const handle = await parentHandle.getDirectoryHandle(directoryName, { create: true });
      const childPermitted = await ensurePermission(handle, "readwrite");
      if (!childPermitted){
        return { ok: false, message: "Folder access was not granted." };
      }
      const savedRecord = {
        handle,
        directoryName: handle.name || directoryName,
        directoryLabel: buildDirectoryLabel(parentHandle.name, handle.name || directoryName)
      };
      await writeHandle(getDirectoryKey(nickname), savedRecord);
      return { ok: true, handle, directoryName: savedRecord.directoryName, directoryLabel: savedRecord.directoryLabel };
    }catch(error){
      if (error && error.name === "AbortError"){
        return { ok: false, cancelled: true, message: "Folder selection cancelled." };
      }
      return { ok: false, message: "Could not open a folder for saved images." };
    }
  }

  function buildImageFileName({ nickname, wave, timestamp, extension }){
    const safeTimestamp = Math.max(0, parseInt(timestamp, 10) || Date.now());
    const safeWave = Math.max(1, parseInt(wave, 10) || 1);
    const ext = String(extension || "jpg").replace(/^\./, "").toLowerCase();
    return `${FILE_PREFIX}__nickname--${encodeURIComponent(String(nickname || "").trim())}__wave--${safeWave}__ts--${safeTimestamp}.${ext}`;
  }

  function parseImageFileName(fileName){
    const match = /^tektite-shooter__nickname--(.+?)__wave--(\d+)__ts--(\d+)\.(jpe?g|png|webp)$/i.exec(String(fileName || ""));
    if (!match) return null;
    try{
      return {
        nickname: decodeURIComponent(match[1]),
        wave: Math.max(1, parseInt(match[2], 10) || 1),
        timestamp: Math.max(0, parseInt(match[3], 10) || 0),
        extension: match[4].toLowerCase()
      };
    }catch(error){
      return null;
    }
  }

  async function saveImageBlobToFolder(options = {}){
    const nickname = String(options.nickname || "").trim();
    if (!nickname){
      return { ok: false, message: "Please set a nickname to save images." };
    }
    if (!supportsSavedImageFolders()){
      return { ok: false, message: "Folder saving is not supported in this browser." };
    }
    const directoryRecord = await getSavedImagesDirectoryRecord({ nickname, write: true });
    const directoryHandle = directoryRecord && directoryRecord.handle;
    if (!directoryHandle){
      return { ok: false, message: "Choose Folder to Save Images first." };
    }
    const blob = options.blob;
    if (!(blob instanceof Blob)){
      return { ok: false, message: "Unable to save image." };
    }
    const extension = blob.type === "image/png" ? "png" : (blob.type === "image/webp" ? "webp" : "jpg");
    const timestamp = Math.max(0, parseInt(options.timestamp, 10) || Date.now());
    const fileName = buildImageFileName({
      nickname,
      wave: options.wave,
      timestamp,
      extension
    });
    try{
      const fileHandle = await directoryHandle.getFileHandle(fileName, { create: true });
      const writable = await fileHandle.createWritable();
      await writable.write(blob);
      await writable.close();
      return {
        ok: true,
        fileName,
        createdAt: new Date(timestamp).toISOString(),
        directoryName: String(directoryRecord.directoryName || directoryHandle.name || "").trim(),
        directoryLabel: String(directoryRecord.directoryLabel || directoryRecord.directoryName || directoryHandle.name || "").trim()
      };
    }catch(error){
      if (error && error.name === "NotAllowedError"){
        return { ok: false, message: "Folder access was not granted." };
      }
      return { ok: false, message: "Could not save image to the selected folder." };
    }
  }

  async function listSavedImages(options = {}){
    const nickname = String(options.nickname || "").trim();
    if (!nickname){
      return { ok: true, supports: supportsSavedImageFolders(), configured: false, items: [] };
    }
    if (!supportsSavedImageFolders()){
      return { ok: false, supports: false, configured: false, items: [], message: "Folder saving is not supported in this browser." };
    }
    const directoryRecord = await getSavedImagesDirectoryRecord({ nickname, write: false });
    const directoryHandle = directoryRecord && directoryRecord.handle;
    if (!directoryHandle){
      return { ok: true, supports: true, configured: false, items: [] };
    }
    const items = [];
    try{
      for await (const entry of directoryHandle.values()){
        if (!entry || entry.kind !== "file") continue;
        const metadata = parseImageFileName(entry.name);
        if (!metadata || metadata.nickname !== nickname) continue;
        const file = await entry.getFile();
        items.push({
          id: entry.name,
          fileName: entry.name,
          nickname: metadata.nickname,
          wave: metadata.wave,
          timestamp: metadata.timestamp || Math.max(0, file.lastModified || Date.now()),
          createdAt: new Date(metadata.timestamp || Math.max(0, file.lastModified || Date.now())).toISOString(),
          objectUrl: URL.createObjectURL(file)
        });
      }
    }catch(error){
      return { ok: false, supports: true, configured: true, items: [], message: "Could not read saved images from the selected folder." };
    }
    items.sort((a, b) => b.timestamp - a.timestamp);
    return {
      ok: true,
      supports: true,
      configured: true,
      directoryName: String(directoryRecord.directoryName || directoryHandle.name || "").trim(),
      directoryLabel: String(directoryRecord.directoryLabel || directoryRecord.directoryName || directoryHandle.name || "").trim(),
      items
    };
  }

  async function deleteSavedImages(options = {}){
    const nickname = String(options.nickname || "").trim();
    if (!nickname){
      return { ok: false, message: "Please set a nickname to save images." };
    }
    const directoryHandle = await getSavedImagesDirectoryHandle({ nickname, write: true });
    if (!directoryHandle){
      return { ok: false, message: "Choose Folder to Save Images first." };
    }
    let removed = 0;
    try{
      for await (const entry of directoryHandle.values()){
        if (!entry || entry.kind !== "file") continue;
        const metadata = parseImageFileName(entry.name);
        if (!metadata || metadata.nickname !== nickname) continue;
        await directoryHandle.removeEntry(entry.name);
        removed += 1;
      }
      return { ok: true, removed };
    }catch(error){
      return { ok: false, message: "Could not clear saved images from the selected folder." };
    }
  }

  window.tektiteShooterSavedImageStorage = {
    supportsSavedImageFolders,
    chooseSavedImagesDirectory,
    getSavedImagesDirectoryHandle,
    listSavedImages,
    saveImageBlobToFolder,
    deleteSavedImages,
    forgetSavedImageFolderConnections
  };
})();
