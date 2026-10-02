# YouTube Music Downloader

Aplicação local para obter informações de vídeos do YouTube e baixar áudio em MP3. Também aceita links de playlists: as faixas são salvas em uma pasta com o nome da playlist, numeradas pela ordem, com metadados de álbum e número da faixa.

## Requisitos

- Node.js e npm
- Acesso à internet para consultar e baixar conteúdo

O FFmpeg e o yt-dlp são fornecidos pelas dependências do projeto.

## Instalação e uso

No terminal, entre na pasta do projeto e execute:

```powershell
npm install
npm start
```

Abra [http://localhost:3000](http://localhost:3000), cole um link de vídeo ou playlist e escolha **Analisar Link**. Depois, clique em **Baixar MP3**.

Os arquivos baixados ficam na pasta `downloads/`, organizada por playlist. Essa pasta é criada automaticamente e não é incluída no Git.

Para parar o servidor, pressione `Ctrl+C` no terminal.

## Observações

- Use somente conteúdo que você tem autorização para baixar e respeite os direitos autorais e os termos de uso do YouTube.
- Este projeto foi pensado para uso local. Não o exponha publicamente sem implementar controles de acesso, validação e limites apropriados.
- Abra a aplicação pelo endereço `http://localhost:3000` com `npm start`; não use uma extensão de servidor estático, pois a aplicação depende das rotas de API do Express.
