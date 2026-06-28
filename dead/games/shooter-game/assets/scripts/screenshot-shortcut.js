(function () {
  const HOTKEY_KEY = 's';

  function isHotkey(event) {
    return event.ctrlKey && event.shiftKey && !event.altKey && !event.metaKey && String(event.key || '').toLowerCase() === HOTKEY_KEY;
  }

  async function saveScreenshot() {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getDisplayMedia) {
      console.warn('Screen capture is not supported in this browser.');
      return;
    }

    let stream;
    try {
      stream = await navigator.mediaDevices.getDisplayMedia({
        video: {
          displaySurface: 'browser'
        },
        audio: false,
        preferCurrentTab: true,
        selfBrowserSurface: 'include',
        surfaceSwitching: 'exclude'
      });

      const track = stream.getVideoTracks()[0];
      if (!track) {
        throw new Error('No video track returned from screen capture.');
      }

      const video = document.createElement('video');
      video.srcObject = stream;
      video.muted = true;
      video.playsInline = true;

      await video.play();

      if ('requestVideoFrameCallback' in video) {
        await new Promise((resolve) => video.requestVideoFrameCallback(() => resolve()));
      } else {
        await new Promise((resolve) => setTimeout(resolve, 150));
      }

      const canvas = document.createElement('canvas');
      canvas.width = video.videoWidth || window.innerWidth;
      canvas.height = video.videoHeight || window.innerHeight;

      const context = canvas.getContext('2d', { alpha: false });
      context.drawImage(video, 0, 0, canvas.width, canvas.height);

      const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/png'));
      if (!blob) {
        throw new Error('Could not encode screenshot PNG.');
      }

      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const pageName = (location.pathname.split('/').filter(Boolean).pop() || 'index').replace(/[^a-z0-9._-]+/gi, '-');
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${pageName}-${timestamp}.png`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (error) {
      console.error('Screenshot capture failed:', error);
    } finally {
      if (stream) {
        stream.getTracks().forEach((track) => track.stop());
      }
    }
  }

  window.tektiteSaveScreenshot = saveScreenshot;

  window.addEventListener('message', (event) => {
    const data = event && event.data ? event.data : null;
    if (!data || data.type !== 'tektite:save-screenshot') return;
    saveScreenshot();
  });

  window.addEventListener('keydown', (event) => {
    if (!isHotkey(event)) return;
    if (event.repeat) return;
    event.preventDefault();
    saveScreenshot();
  }, true);
})();
