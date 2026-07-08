let hlsInstance = null;
let objectUrls = [];
let hlsLibraryPromise = null;

async function loadHlsLibrary() {
  if (window.Hls) return window.Hls;
  if (!hlsLibraryPromise) {
    hlsLibraryPromise = new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = '/vendor/hls.min.js';
      script.onload = () => window.Hls ? resolve(window.Hls) : reject(new Error('HLS 播放组件未正确初始化'));
      script.onerror = () => reject(new Error('HLS 播放组件加载失败'));
      document.head.appendChild(script);
    }).catch(error => { hlsLibraryPromise = null; throw error; });
  }
  return hlsLibraryPromise;
}

async function tryPlay(video) {
  try { await video.play(); }
  catch (error) {
    if (error?.name === 'NotAllowedError') return;
    throw error;
  }
}

export async function playStream(video, url, preferNative = true, resumeAt = 0) {
  stopStream(video);
  if (!/^https?:\/\//i.test(url) && !url.startsWith('/api/stream?')) throw new Error('播放地址格式无效');
  const seek = () => { if (resumeAt > 3 && Number.isFinite(video.duration) && resumeAt < video.duration - 5) video.currentTime = resumeAt; };
  const decodedUrl = (() => { try { return decodeURIComponent(url); } catch { return url; } })();
  const isHls = /\.m3u8(?:$|[?&])/i.test(decodedUrl);

  if (preferNative && (video.canPlayType('application/vnd.apple.mpegurl') || !isHls)) {
    video.src = url;
    video.addEventListener('loadedmetadata', seek, { once: true });
    await tryPlay(video);
    return;
  }

  const Hls = await loadHlsLibrary();
  if (!Hls.isSupported()) throw new Error('当前浏览器不支持 HLS 播放');
  hlsInstance = new Hls({
    enableWorker: true,
    lowLatencyMode: false,
    backBufferLength: 90,
    maxBufferLength: 45,
    manifestLoadingTimeOut: 12000,
    fragLoadingTimeOut: 20000,
    levelLoadingTimeOut: 12000,
  });
  hlsInstance.loadSource(url);
  hlsInstance.attachMedia(video);

  await new Promise((resolve, reject) => {
    let settled = false;
    let networkRetries = 0;
    let mediaRetries = 0;
    const finish = (error) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      error ? reject(error) : resolve();
    };
    const timeout = setTimeout(() => finish(new Error('播放列表加载超时')), 25000);
    hlsInstance.on(Hls.Events.MANIFEST_PARSED, () => finish());
    hlsInstance.on(Hls.Events.ERROR, (_event, data) => {
      if (!data.fatal || settled) return;
      if (data.type === Hls.ErrorTypes.NETWORK_ERROR && networkRetries < 2) {
        networkRetries += 1;
        hlsInstance.startLoad();
        return;
      }
      if (data.type === Hls.ErrorTypes.MEDIA_ERROR && mediaRetries < 2) {
        mediaRetries += 1;
        hlsInstance.recoverMediaError();
        return;
      }
      finish(new Error(`播放失败：${data.details || data.type || '未知错误'}`));
    });
  });

  video.addEventListener('loadedmetadata', seek, { once: true });
  await tryPlay(video);
}

function srtToVtt(text) {
  return `WEBVTT\n\n${text.replace(/^\uFEFF/, '').replace(/\r+/g, '').replace(/(\d{2}:\d{2}:\d{2}),(\d{3})/g, '$1.$2')}`;
}

async function subtitleUrl(subtitle) {
  if (!['vtt', 'srt', ''].includes((subtitle.format || '').toLowerCase())) throw new Error('当前仅支持 VTT 和 SRT 字幕');
  const response = await fetch(subtitle.url, { credentials: 'omit', referrerPolicy: 'no-referrer' });
  if (!response.ok) throw new Error(`字幕加载失败（${response.status}）`);
  let text = await response.text();
  if ((subtitle.format || '').toLowerCase() === 'srt' || /\.srt(?:$|\?)/i.test(subtitle.url)) text = srtToVtt(text);
  const blobUrl = URL.createObjectURL(new Blob([text], { type: 'text/vtt' }));
  objectUrls.push(blobUrl);
  return blobUrl;
}

export async function loadSubtitle(video, subtitle) {
  [...video.querySelectorAll('track')].forEach(track => track.remove());
  if (!subtitle) return;
  const track = document.createElement('track');
  track.kind = 'subtitles';
  track.label = subtitle.name || subtitle.lang || '字幕';
  track.srclang = subtitle.lang || 'zh';
  track.src = subtitle.localUrl || await subtitleUrl(subtitle);
  track.default = true;
  video.appendChild(track);
  track.addEventListener('load', () => { [...video.textTracks].forEach(t => t.mode = t === track.track ? 'showing' : 'disabled'); }, { once: true });
}

export async function localSubtitle(file) {
  if (!/\.(vtt|srt)$/i.test(file.name)) throw new Error('请选择 VTT 或 SRT 字幕文件');
  if (file.size > 5_000_000) throw new Error('字幕文件不能超过 5 MB');
  let text = await file.text();
  if (/\.srt$/i.test(file.name)) text = srtToVtt(text);
  const localUrl = URL.createObjectURL(new Blob([text], { type: 'text/vtt' }));
  objectUrls.push(localUrl);
  return { name: file.name, lang: 'local', format: 'vtt', localUrl };
}

export function stopStream(video) {
  if (hlsInstance) { hlsInstance.destroy(); hlsInstance = null; }
  video.pause();
  video.removeAttribute('src');
  [...video.querySelectorAll('track')].forEach(track => track.remove());
  video.load();
  objectUrls.forEach(URL.revokeObjectURL);
  objectUrls = [];
}
