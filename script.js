'use strict';

const form = document.querySelector('#formulario');
const formPanel = document.querySelector('#dados');
const previewPanel = document.querySelector('#previa');
const generateAgain = document.querySelector('#gerar-novamente');
const canvas = document.querySelector('#certificado');
const context = canvas.getContext('2d');
const status = document.querySelector('#status');
const generate = document.querySelector('#gerar');
const download = document.querySelector('#baixar');
const template = new Image();
let downloadUrl;
let nameFontLoaded = false;

const today = new Date();
document.querySelector('#data').value = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

// Coordinates use the original template's 1536 × 1024 reference space.
// Scale independently so the output keeps the source image's full resolution.
function drawText(text, y, size, maxWidth, weight = 'normal', family = 'Arial, sans-serif') {
  context.font = `${weight} ${size}px ${family}`;
  const width = context.measureText(text).width;
  if (width > maxWidth) {
    context.font = `${weight} ${size * maxWidth / width}px ${family}`;
  }
  context.fillText(text, 768, y);
}

function drawTemplate() {
  context.setTransform(1, 0, 0, 1, 0, 0);
  context.clearRect(0, 0, canvas.width, canvas.height);
  context.drawImage(template, 0, 0);
}

const beltColors = {
  Branca: '#ffffff', Cinza: '#808080', Amarela: '#e6b800',
  Laranja: '#ed7818', Verde: '#21843b', Azul: '#071b68',
  Roxa: '#70359a', Marrom: '#75452c', Preta: '#111111',
};
const degreeNames = ['', 'PRIMEIRO', 'SEGUNDO', 'TERCEIRO', 'QUARTO'];

function drawGraduation(belt, degree) {
  const [primary] = belt.split(' e ');
  context.save();
  context.strokeStyle = '#111111';
  context.lineJoin = 'round';

  function drawLine(text, y, size, weight, lineLength) {
    context.font = `${weight} ${size}px Arial, sans-serif`;
    const maxWidth = 1030 - 2 * (lineLength + 24);
    const initialWidth = context.measureText(text).width;
    if (initialWidth > maxWidth) {
      context.font = `${weight} ${size * maxWidth / initialWidth}px Arial, sans-serif`;
    }
    const metrics = context.measureText(text);
    context.fillStyle = beltColors[primary] || '#111111';
    context.lineWidth = 2.5;
    context.strokeText(text, 768, y);
    context.fillText(text, 768, y);
    const gap = metrics.width / 2 + 24;
    for (const x of [768 - gap - lineLength, 768 + gap]) {
      context.strokeRect(x, y - 1.5, lineLength, 3);
      context.fillRect(x, y - 1.5, lineLength, 3);
    }
  }

  drawLine(`FAIXA ${belt.toLocaleUpperCase('pt-BR')}`, 688, 62, 'bold', 130);
  if (degreeNames[Number(degree)]) {
    drawLine(`${degreeNames[Number(degree)]} GRAU`, 734, 28, 'normal', 42);
  }
  context.restore();
}

template.onload = () => {
  canvas.width = template.naturalWidth;
  canvas.height = template.naturalHeight;
  drawTemplate();
  generate.disabled = false;
  status.textContent = 'Preencha os dados e clique em Gerar.';
};
template.onerror = () => {
  status.textContent = 'Não foi possível carregar o modelo. Verifique o arquivo assets/modelo.js e recarregue a página.';
};
// Embedded copy of assets/modelo.png permits PNG downloads even over file://.
template.src = window.CERTIFICATE_TEMPLATE || 'assets/modelo.png';

for (const field of form.querySelectorAll('input')) {
  field.addEventListener('input', () => field.setCustomValidity(''));
}

form.addEventListener('input', () => {
  download.hidden = true;
  if (downloadUrl) {
    URL.revokeObjectURL(downloadUrl);
    downloadUrl = undefined;
  }
  if (!generate.disabled) status.textContent = 'Dados alterados. Clique em Gerar para atualizar o certificado.';
});

generateAgain.addEventListener('click', () => {
  document.querySelector('#nome').value = '';
  document.querySelector('#nome').setCustomValidity('');
  document.querySelector('#faixa').value = '';
  document.querySelector('#grau').value = '0';
  download.hidden = true;
  download.removeAttribute('href');
  if (downloadUrl) {
    URL.revokeObjectURL(downloadUrl);
    downloadUrl = undefined;
  }
  previewPanel.hidden = true;
  formPanel.hidden = false;
  status.textContent = 'Preencha os dados e clique em Gerar.';
  document.querySelector('#nome').focus();
});

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  for (const field of form.querySelectorAll('input[required]')) {
    field.setCustomValidity(field.value.trim() ? '' : 'Preencha este campo.');
  }
  if (!form.reportValidity()) return;

  generate.disabled = true;
  download.hidden = true;
  const data = new FormData(form);
  const name = data.get('nome').trim().toLocaleLowerCase('pt-BR')
    .replace(/\p{L}[\p{L}\p{M}]*/gu, word => word.charAt(0).toLocaleUpperCase('pt-BR') + word.slice(1));
  const belt = data.get('faixa').trim().replace(/^faixa\s+/i, '');
  const degree = data.get('grau');
  const [year, month, day] = data.get('data').split('-').map(Number);
  const date = new Date(0);
  date.setFullYear(year, month - 1, day);
  const formattedDate = date.toLocaleDateString('pt-BR', { day: 'numeric', month: 'long', year: 'numeric' });

  try {
    if (!nameFontLoaded) {
      const nameFont = new FontFace('CertificateName', `url("${window.CERTIFICATE_NAME_FONT}")`, { weight: '400' });
      await nameFont.load();
      document.fonts.add(nameFont);
      nameFontLoaded = true;
    }
    drawTemplate();
    context.setTransform(canvas.width / 1536, 0, 0, canvas.height / 1024, 0, 0);
    context.fillStyle = '#141414';
    context.textAlign = 'center';
    context.textBaseline = 'middle';
    drawText(name, 542, 100, 1030, 'normal', '"CertificateName", cursive');
    drawGraduation(belt, degree);
    drawText(`${data.get('local').trim()}, ${formattedDate}`, 794, 27, 1090);

    const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/png'));
    if (!blob) throw new Error('PNG indisponível');
    if (downloadUrl) URL.revokeObjectURL(downloadUrl);
    downloadUrl = URL.createObjectURL(blob);
    download.href = downloadUrl;
    download.download = `certificado-${name.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'aluno'}.png`;
    download.hidden = false;
    canvas.setAttribute('aria-label', `Certificado de ${name}, faixa ${belt}, ${degree} grau(s), ${data.get('local').trim()}, ${formattedDate}`);
    status.textContent = `Certificado gerado em ${canvas.width} × ${canvas.height} pixels. Clique em Baixar PNG para salvar.`;
    formPanel.hidden = true;
    previewPanel.hidden = false;
    document.querySelector('#previa-titulo').focus();
  } catch (error) {
    status.textContent = 'Não foi possível gerar a imagem. Recarregue a página e tente novamente.';
    console.error(error);
  } finally {
    generate.disabled = false;
  }
});
