let currentUrl = '';
let currentTrack = null;
let downloadQueue = [];
let finishedDownloads = [];
let currentDownload = null;
let isProcessingQueue = false;

async function readApiResponse(response, fallbackMessage) {
  const body = await response.text();
  let data;

  try {
    data = JSON.parse(body);
  } catch {
    const detail = body.trim();
    const message = detail
      ? `${fallbackMessage} (HTTP ${response.status}): ${detail}`
      : `${fallbackMessage} (HTTP ${response.status}, resposta inválida).`;
    throw new Error(message);
  }

  if (!response.ok) {
    throw new Error(data?.error || fallbackMessage);
  }

  if (!data || typeof data !== 'object') {
    throw new Error(`${fallbackMessage} Resposta inválida do servidor.`);
  }

  return data;
}

async function analyzeLink() {
  const urlInput = document.getElementById('urlInput').value.trim();
  const statusMessage = document.getElementById('statusMessage');
  const infoCard = document.getElementById('infoCard');

  if (!urlInput) {
    statusMessage.innerText = 'Por favor, insira um link do YouTube.';
    statusMessage.style.color = '#ff4d4d';
    return;
  }

  currentUrl = '';
  currentTrack = null;
  statusMessage.innerText = 'A analisar o link...';
  statusMessage.style.color = '#ccc';
  infoCard.classList.add('hidden');

  try {
    const response = await fetch('/api/info', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: urlInput }),
    });

    const data = await readApiResponse(response, 'Erro ao analisar o link.');

    currentUrl = urlInput;
    currentTrack = {
      url: urlInput,
      title: data.title || 'Título desconhecido',
      isPlaylist: data.isPlaylist === true,
      tracks: data.tracks || [],
    };

    document.getElementById('coverImg').src = data.thumbnail || '';
    document.getElementById('songTitle').innerText = data.title || 'Título desconhecido';
    document.getElementById('songUploader').innerText = data.isPlaylist
      ? `${data.uploader || 'Desconhecido'} · ${data.tracks.length} músicas`
      : data.uploader || 'Artista desconhecido';

    document.getElementById('downloadBtn').innerText = data.isPlaylist
      ? 'Adicionar playlist à fila'
      : 'Adicionar à fila';

    infoCard.classList.remove('hidden');
    statusMessage.innerText = '';
  } catch (error) {
    statusMessage.innerText = error.message;
    statusMessage.style.color = '#ff4d4d';
  }
}

function createQueuePacman(progress = 0) {
  const container = document.createElement('div');
  container.className = 'queue-pacman-container';

  const pacman = document.createElement('div');
  pacman.className = 'queue-pacman';

  const mouthTop = document.createElement('div');
  mouthTop.className = 'queue-mouth-top';

  const eye = document.createElement('div');
  eye.className = 'queue-eye';
  mouthTop.appendChild(eye);

  const mouthBottom = document.createElement('div');
  mouthBottom.className = 'queue-mouth-bottom';

  pacman.append(mouthTop, mouthBottom);

  const notes = document.createElement('div');
  notes.className = 'queue-notes';

  ['♪', '♫', '♩'].forEach((symbol, index) => {
    const note = document.createElement('span');
    note.className = `queue-note queue-note-${index + 1}`;
    note.innerText = symbol;
    notes.appendChild(note);
  });

  const percent = document.createElement('span');
  percent.className = 'queue-progress-percent';
  percent.innerText = `${Math.floor(progress)}%`;

  container.append(pacman, notes, percent);
  return container;
}

function getTrackOrderPrefix(track) {
  if (!track.playlistIndex) return '';

  const width = Number(track.playlistIndexWidth) || 1;
  return `${String(track.playlistIndex).padStart(width, '0')} - `;
}

function updateCurrentDownloadProgress() {
  if (!currentDownload) return;

  const percent = Math.floor(currentDownload.progress || 0);
  const title = document.querySelector('.queue-current-title');
  const progressLabel = document.querySelector('.queue-progress-percent');

  if (title) {
    title.innerText = `Baixando agora — ${getTrackOrderPrefix(currentDownload)}${currentDownload.title} (${percent}%)`;
  }

  if (progressLabel) {
    progressLabel.innerText = `${percent}%`;
  }
}

function renderQueue() {
  const currentElement = document.getElementById('currentDownload');
  const queueList = document.getElementById('queueList');

  currentElement.innerText = currentDownload
    ? `Baixando · ${downloadQueue.length} aguardando`
    : downloadQueue.length > 0
      ? `${downloadQueue.length} música(s) aguardando`
      : 'Nenhum download em andamento.';

  queueList.replaceChildren();

  if (currentDownload) {
    const entry = document.createElement('li');
    entry.classList.add('queue-item-active');

    const title = document.createElement('span');
    title.className = 'queue-current-title';
    title.innerText = `Baixando agora — ${getTrackOrderPrefix(currentDownload)}${currentDownload.title}`;

    entry.append(title, createQueuePacman(currentDownload.progress || 0));
    queueList.appendChild(entry);
  }

  downloadQueue.forEach((item, index) => {
    const entry = document.createElement('li');
    const order = item.playlistIndex
      ? getTrackOrderPrefix(item)
      : `${index + 1}. `;
    entry.innerText = `${order}${item.title} — aguardando`;
    queueList.appendChild(entry);
  });

  finishedDownloads.slice().reverse().forEach((item) => {
    const entry = document.createElement('li');
    entry.innerText = item.status === 'concluído'
      ? `👍 ${item.title} — Saboroso!${item.location ? ` · ${item.location}` : ''}`
      : `❌ ${item.title} — ${item.status}`;
    queueList.appendChild(entry);
  });
}

async function processDownloadQueue() {
  if (isProcessingQueue) return;

  isProcessingQueue = true;

  while (downloadQueue.length > 0) {
    currentDownload = downloadQueue.shift();
    renderQueue();

    try {
      const response = await fetch('/api/download', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url: currentDownload.url,
          isPlaylist: currentDownload.isPlaylist,
          playlistTitle: currentDownload.playlistTitle,
          playlistIndex: currentDownload.playlistIndex,
          playlistIndexWidth: currentDownload.playlistIndexWidth,
        }),
      });

      if (!response.ok) {
        await readApiResponse(response, 'Erro durante o download.');
      }
      if (!response.body) {
        throw new Error('O navegador não conseguiu receber o progresso do download.');
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let completionEvent = null;

      const handleDownloadEvent = (line) => {
        if (!line.trim()) return;
        const event = JSON.parse(line);

        if (event.type === 'progress') {
          currentDownload.progress = event.percent;
          updateCurrentDownloadProgress();
        } else if (event.type === 'error') {
          throw new Error(event.error || 'Erro durante o download.');
        } else if (event.type === 'done') {
          completionEvent = event;
        }
      };

      while (true) {
        const { value, done } = await reader.read();
        buffer += decoder.decode(value || new Uint8Array(), { stream: !done });

        const lines = buffer.split(/\r?\n/);
        buffer = lines.pop() || '';

        for (const line of lines) {
          handleDownloadEvent(line);
        }

        if (done) break;
      }

      if (buffer.trim()) {
        handleDownloadEvent(buffer);
      }

      if (!completionEvent) {
        throw new Error('O servidor encerrou o download sem confirmar a conclusão.');
      }

      finishedDownloads.push({
        title: currentDownload.title,
        status: 'concluído',
        location: completionEvent.location,
      });
    } catch (error) {
      finishedDownloads.push({
        title: currentDownload.title,
        status: `falhou: ${error.message}`,
      });
    }

    currentDownload = null;
    renderQueue();
  }

  isProcessingQueue = false;
  renderQueue();
}

function startDownload() {
  if (!currentTrack) {
    const statusMessage = document.getElementById('statusMessage');
    statusMessage.innerText = 'Analise um link antes de adicionar à fila.';
    statusMessage.style.color = '#ff4d4d';
    return;
  }

  const tracksToAdd = currentTrack.isPlaylist
    ? currentTrack.tracks
    : [{ url: currentTrack.url, title: currentTrack.title }];

  const highestPlaylistIndex = tracksToAdd.reduce((highest, track, index) => {
    const playlistIndex = Number(track.playlistIndex) || index + 1;
    return Math.max(highest, playlistIndex);
  }, tracksToAdd.length);
  const playlistIndexWidth = String(highestPlaylistIndex).length;

  tracksToAdd.forEach((track, index) => {
    downloadQueue.push({
      url: track.url,
      title: track.title,
      isPlaylist: currentTrack.isPlaylist,
      playlistTitle: currentTrack.isPlaylist ? currentTrack.title : '',
      playlistIndex: currentTrack.isPlaylist
        ? Number(track.playlistIndex) || index + 1
        : null,
      playlistIndexWidth: currentTrack.isPlaylist ? playlistIndexWidth : null,
    });
  });

  const statusMessage = document.getElementById('statusMessage');
  statusMessage.innerText = currentTrack.isPlaylist
    ? `${tracksToAdd.length} músicas da playlist adicionadas à fila.`
    : `${currentTrack.title} foi adicionada à fila.`;
  statusMessage.style.color = '#00ff88';

  currentUrl = '';
  currentTrack = null;
  document.getElementById('infoCard').classList.add('hidden');

  renderQueue();
  processDownloadQueue();
}

renderQueue();