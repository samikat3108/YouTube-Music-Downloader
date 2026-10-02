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
    const info = await ytDlp(url, {
      dumpSingleJson: true,
      noWarnings: true,
      noPlaylist: true,
    });

    return res.json({
      title: info.title,
      uploader: info.uploader || info.artist || 'Desconhecido',
      thumbnail: info.thumbnail,
    });
  } catch (error) {
    console.error('Erro ao analisar link:', error);
    return res.status(500).json({ error: 'Erro ao obter informações da música.' });
  }
});

// Rota para baixar e salvar permanentemente na pasta downloads/ do projeto
app.post('/api/download', async (req, res) => {
  const { url } = req.body;

  if (!url) {
    return res.status(400).json({ error: 'URL não fornecida.' });
  }

  const outputTemplate = path.join(downloadsDir, '%(playlist_title|Faixas avulsas)s', '%(playlist_index|1)02d - %(title)s.%(ext)s');

  try {
    await ytDlp(url, {
      extractAudio: true,
      audioFormat: 'mp3',
      audioQuality: '0',
      embedThumbnail: true,
      addMetadata: true,
      parseMetadata: [
        'playlist_title:%(album)s',
        'playlist_index:%(track_number)s',
      ],
      ffmpegLocation: ffmpegPath,
      output: outputTemplate,
    });

    // Limpa ficheiros temporários de imagem deixados pelo yt-dlp (.jpg, .webp, .png)
    const files = fs.readdirSync(downloadsDir);
    files.forEach(file => {
      if (file.endsWith('.jpg') || file.endsWith('.webp') || file.endsWith('.png') || file.endsWith('.part')) {
        try {
          fs.unlinkSync(path.join(downloadsDir, file));
        } catch (e) {
          // ignora erro se o ficheiro estiver bloqueado
        }
      }
    });

    // Responde com sucesso (salvo diretamente na pasta downloads/ do projeto)
    return res.json({ success: true, message: 'Música salva na pasta downloads!' });

  } catch (error) {
    console.error('Erro ao baixar música:', error);
    return res.status(500).json({ error: 'Erro no processamento do download.' });
  }
});

app.listen(PORT, () => {
  console.log(`Servidor a correr em http://localhost:${PORT}`);
});