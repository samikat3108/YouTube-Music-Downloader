# YouTube Music Downloader

Aplicação local para analisar links do YouTube e baixar áudio em MP3. Também aceita playlists: adiciona as faixas à fila na ordem da playlist e organiza os arquivos em uma pasta própria.

## Recursos

- Download de áudio em MP3 com a melhor qualidade de áudio disponível na fonte.
- Downloads de faixas avulsas e playlists em uma fila sequencial.
- Pasta por playlist e prefixo numérico nos arquivos para preservar a ordem.
- Exibição do progresso do download na fila.
- Capa e metadados incorporados quando disponíveis.

## Requisitos

- Node.js 18 ou superior
- npm
- Acesso à internet

O projeto instala `yt-dlp` e FFmpeg por meio das dependências npm.

## Instalação e execução

```sh
npm ci
npm start
```

Abra [http://localhost:3000](http://localhost:3000), cole um link de música ou playlist e clique em **Analisar Link**. Depois, adicione a faixa ou playlist à fila.

Os arquivos ficam na pasta `downloads/`, criada automaticamente. Faixas de playlists são salvas em `downloads/<nome da playlist>/` com números no início do nome para facilitar a ordenação.

Para parar o servidor, pressione `Ctrl+C` no terminal.

## Sobre esta versão

Esta versão do projeto não receberá mais atualizações do autor original. Sinta-se à vontade para estudar o código, adaptá-lo, corrigir problemas ou desenvolver novas funcionalidades conforme suas necessidades.

## Uso responsável

Use a aplicação apenas para conteúdo que você tem autorização para baixar. Respeite os direitos autorais e os termos de uso do YouTube. O servidor foi projetado para uso local; não o exponha à internet sem implementar controles de acesso e limites apropriados.

## Licença

Este projeto está licenciado sob a licença MIT. Consulte [LICENSE](./LICENSE).
