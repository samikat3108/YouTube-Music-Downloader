let currentUrl = '';
let progressInterval = null;

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
  const loadingSection = document.getElementById('loadingSection');

  if (!urlInput) {
    statusMessage.innerText = 'Por favor, insira um link do YouTube.';
    statusMessage.style.color = '#ff4d4d';
    return;
  }

  statusMessage.innerText = 'A analisar a música...';
  statusMessage.style.color = '#ccc';
  infoCard.classList.add('hidden');
  loadingSection.classList.add('hidden');

  try {
    const response = await fetch('/api/info', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: urlInput }),
    });

    const data = await readApiResponse(response, 'Erro ao analisar o link.');

    currentUrl = urlInput;
    document.getElementById('coverImg').src = data.thumbnail;
    document.getElementById('songTitle').innerText = data.title;
    document.getElementById('songUploader').innerText = data.uploader;

    infoCard.classList.remove('hidden');
    statusMessage.innerText = '';
  } catch (error) {
    statusMessage.innerText = error.message;
    statusMessage.style.color = '#ff4d4d';
  }
}

async function startDownload() {
  const statusMessage = document.getElementById('statusMessage');
  const infoCard = document.getElementById('infoCard');
  const loadingSection = document.getElementById('loadingSection');
  const progressBarFill = document.getElementById('progressBarFill');
  const urlInput = document.getElementById('urlInput');

  if (!currentUrl) return;

  // Esconde o card e mostra o Pac-Man
  infoCard.classList.add('hidden');
  loadingSection.classList.remove('hidden');
  statusMessage.innerText = '';

  // Animação da barra de progresso (0% até 90%)
  let progress = 0;
  progressBarFill.style.width = '0%';
  progressInterval = setInterval(() => {
    if (progress < 90) {
      progress += Math.floor(Math.random() * 8) + 2;
      if (progress > 90) progress = 90;
      progressBarFill.style.width = progress + '%';
    }
  }, 350);

  try {
    const response = await fetch('/api/download', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: currentUrl }),
    });

    const data = await readApiResponse(response, 'Erro durante o download.');

    // Completa a barra em 100%
    clearInterval(progressInterval);
    progressBarFill.style.width = '100%';

    setTimeout(() => {
      loadingSection.classList.add('hidden');
      statusMessage.innerText = 'Música salva na pasta downloads!';
      statusMessage.style.color = '#00ff88';

      // Reseta o input e a tela para baixar outra música
      urlInput.value = '';
      currentUrl = '';
      progressBarFill.style.width = '0%';
    }, 600);

  } catch (error) {
    clearInterval(progressInterval);
    loadingSection.classList.add('hidden');
    statusMessage.innerText = error.message;
    statusMessage.style.color = '#ff4d4d';
  }
}