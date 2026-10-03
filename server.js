const express = require('express');
const path = require('path');
const fs = require('fs');
const ytDlp = require('yt-dlp-exec');
const ffmpegPath = require('ffmpeg-static');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

const downloadsDir = path.join(__dirname, 'downloads');
if (!fs.existsSync(downloadsDir)) {
  fs.mkdirSync(downloadsDir, { recursive: true });
}

// Rota para analisar a música
app.post('/api/info', async (req, res) => {
  const { url } = req.body;

  if (!url) {
    return res.status(400).json({ error: 'URL não fornecida.' });
  }

  try {
    const parsedUrl = new URL(url);
    const hasPlaylistId = parsedUrl.searchParams.has('list');
    const hasVideoId = parsedUrl.searchParams.has('v');
    const isPlaylist = hasPlaylistId &&
      (/\/playlist\/?$/i.test(parsedUrl.pathname) || !hasVideoId);

    const info = await ytDlp(url, {
      dumpSingleJson: true,
      noWarnings: true,
      ...(isPlaylist
        ? { flatPlaylist: true }
        : { noPlaylist: true }),
    });

    if (isPlaylist) {
      const tracks = (info.entries || [])
        .filter((entry) => entry && (entry.id || entry.url))
        .map((entry, index) => {
          const videoId = entry.id || entry.url;
          const trackUrl = entry.webpage_url ||
            (String(videoId).startsWith('http')
              ? videoId
              : `https://www.youtube.com/watch?v=${encodeURIComponent(videoId)}`);

          return {
            url: trackUrl,
            title: entry.title || 'Título desconhecido',
            playlistIndex: index + 1,
          };
        });

      if (tracks.length === 0) {
        return res.status(400).json({
          error: 'Não foi possível encontrar músicas nessa playlist.',
        });
      }

      return res.json({
        isPlaylist: true,
        title: info.title || 'Playlist do YouTube',
        uploader: info.uploader || 'Desconhecido',
        tracks,
      });
    }

    return res.json({
      isPlaylist: false,
      title: info.title,
      uploader: info.uploader || info.artist || 'Desconhecido',
      thumbnail: info.thumbnail,
    });
  } catch (error) {
    console.error('Erro ao analisar link:', error);
    return res.status(500).json({ error: 'Erro ao obter informações do link.' });
  }
});

// Rota para baixar e salvar permanentemente na pasta downloads/ do projeto
app.post('/api/download', async (req, res) => {
  const {
    url,
    isPlaylist = false,
    playlistTitle,
    playlistIndex,
    playlistIndexWidth,
  } = req.body;

  if (!url) {
    return res.status(400).json({ error: 'URL não fornecida.' });
  }

  const isPlaylistDownload = isPlaylist === true ||
    (typeof playlistTitle === 'string' && playlistTitle.trim().length > 0);
  const safePlaylistTitle = isPlaylistDownload
    ? String(playlistTitle || 'Playlist do YouTube')
      .replace(/[<>:"/\\|?*\x00-\x1F]/g, '_')
      .replace(/[. ]+$/g, '')
      .trim()
      .slice(0, 120)
    : '';

  if (isPlaylistDownload && !safePlaylistTitle) {
    return res.status(400).json({ error: 'Não foi possível criar um nome válido para a pasta da playlist.' });
  }

  const outputDir = safePlaylistTitle
    ? path.join(downloadsDir, safePlaylistTitle)
    : downloadsDir;
  const resolvedOutputDir = path.resolve(outputDir);

  if (resolvedOutputDir !== downloadsDir &&
      !resolvedOutputDir.startsWith(`${downloadsDir}${path.sep}`)) {
    return res.status(400).json({ error: 'Nome de pasta de playlist inválido.' });
  }

  const validPlaylistIndex = Number.isSafeInteger(Number(playlistIndex)) &&
    Number(playlistIndex) > 0
    ? Number(playlistIndex)
    : null;
  const validPlaylistIndexWidth = Number.isSafeInteger(Number(playlistIndexWidth))
    ? Math.min(6, Math.max(1, Number(playlistIndexWidth)))
    : 1;
  const filenamePrefix = validPlaylistIndex
    ? `${String(validPlaylistIndex).padStart(validPlaylistIndexWidth, '0')} - `
    : '';
  const outputTemplates = path.join(
    resolvedOutputDir,
    `${filenamePrefix}%(title)s.%(ext)s`
  );

  const options = {
    noPlaylist: true,
    ffmpegLocation: ffmpegPath,
    output: outputTemplates,
    progress: true,
    progressDelta: 0.25,
    newline: true,
    progressTemplate: 'download:__YT_PROGRESS__%(progress._percent_str)s',
    extractAudio: true,
    audioFormat: 'mp3',
    audioQuality: '0',
    embedThumbnail: true,
    addMetadata: true,
    parseMetadata: [
      'playlist_title:%(playlist_title)s',
      'playlist_index:%(playlist_index)s',
    ],
  };

  try {
    fs.mkdirSync(resolvedOutputDir, { recursive: true });
    console.log(`Diretório de saída do download: ${resolvedOutputDir}`);
    if (filenamePrefix) {
      console.log(`Prefixo de ordem da faixa: ${filenamePrefix}`);
    }

    const downloadProcess = ytDlp.exec(url, options);
    let stdoutBuffer = '';
    let stderrBuffer = '';
    let lastPercent = -1;

    res.status(200);
    res.setHeader('Content-Type', 'application/x-ndjson; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.flushHeaders();

    const handleProgressOutput = (chunk, stream) => {
      let pendingOutput = stream === 'stdout' ? stdoutBuffer : stderrBuffer;
      pendingOutput += chunk.toString();
      const lines = pendingOutput.split(/[\r\n]+/);
      pendingOutput = lines.pop() || '';

      for (const rawLine of lines) {
        const line = rawLine.replace(/\x1b\[[0-9;]*m/g, '');
        const templateMatch = line.match(/__YT_PROGRESS__\s*([0-9]+(?:\.[0-9]+)?)\s*%/);
        const defaultMatch = line.match(/\[download\]\s*([0-9]+(?:\.[0-9]+)?)%\s+of\b/);
        const match = templateMatch || defaultMatch;
        if (!match || res.writableEnded) continue;

        const percent = Number(match[1]);
        if (!Number.isFinite(percent) || percent === lastPercent) continue;

        lastPercent = percent;
        res.write(`${JSON.stringify({
          type: 'progress',
          percent: Math.min(100, Math.max(0, percent)),
        })}\n`);
      }

      if (stream === 'stdout') stdoutBuffer = pendingOutput;
      else stderrBuffer = pendingOutput;
    };

    downloadProcess.stdout.on('data', (chunk) => handleProgressOutput(chunk, 'stdout'));
    downloadProcess.stderr.on('data', (chunk) => handleProgressOutput(chunk, 'stderr'));

    await downloadProcess;
    handleProgressOutput('\n', 'stdout');
    handleProgressOutput('\n', 'stderr');

    if (!res.writableEnded) {
      res.end(`${JSON.stringify({
        type: 'done',
        success: true,
        location: safePlaylistTitle
          ? path.join('downloads', safePlaylistTitle)
          : 'downloads',
        message: 'Música salva na pasta downloads/ do projeto.',
      })}\n`);
    }
  } catch (error) {
    console.error('Erro ao baixar mídia:', error);
    if (res.headersSent) {
      if (!res.writableEnded) {
        res.end(`${JSON.stringify({
          type: 'error',
          error: 'Erro no processamento do download.',
        })}\n`);
      }
      return;
    }
    return res.status(500).json({ error: 'Erro no processamento do download.' });
  }
});

app.listen(PORT, () => {
  console.log(`Servidor a correr em http://localhost:${PORT}`);
});