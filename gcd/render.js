// ===== DOM Elements =====
const startButton = document.getElementById('start-button');
const stopButton = document.getElementById('stop-button');
const captureButton = document.getElementById('capture-button');
const analyzeButton = document.getElementById('analyze-button');
const waitButton = document.getElementById('wait-button');
const numInput = document.getElementById('num_wait');
const enterButton = document.getElementById('enter');
const resultText = document.getElementById('result-text');
const resultCard = document.getElementById('result-card');
const resultIcon = document.getElementById('result-icon');
const canvas = document.getElementById('captured-image');
const ctx = canvas.getContext('2d');
const video = document.getElementById('webcam');
const videoContainer = document.getElementById('video-container');
const videoPlaceholder = document.getElementById('video-placeholder');
const statusChip = document.getElementById('status-chip');
const statusText = document.getElementById('status-text');
const manualPanel = document.getElementById('manual-input-panel');
const predCount = document.getElementById('pred-count');

let stream = null;
let predictions = 0;

// ===== Helpers =====
function setStatus(state, text) {
  statusChip.className = 'status-chip';
  if (state) statusChip.classList.add(state);
  statusText.textContent = text;
}

function setResult(type, text, icon) {
  resultCard.className = 'result-card';
  if (type) resultCard.classList.add(type);
  resultText.textContent = text;

  const icons = {
    info: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>',
    success: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>',
    error: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>',
    waiting: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>',
  };
  resultIcon.innerHTML = icons[icon || type] || icons.info;
}

function updatePredCount() {
  predictions++;
  predCount.textContent = `${predictions} prediction${predictions !== 1 ? 's' : ''}`;
}

// ===== Camera Controls =====
startButton.addEventListener('click', async () => {
  try {
    setStatus('processing', 'Connecting...');
    stream = await navigator.mediaDevices.getUserMedia({ video: true });
    video.srcObject = stream;
    video.classList.add('active');
    videoPlaceholder.classList.add('hidden');
    setStatus('active', 'Camera Live');
    setResult('', 'Camera active — click Capture to detect weight', 'info');
  } catch (error) {
    console.error('Error accessing webcam:', error);
    setStatus('', 'Error');
    setResult('error', 'Could not access webcam. Check permissions.', 'error');
  }
});

stopButton.addEventListener('click', () => {
  if (stream) {
    stream.getTracks().forEach(track => track.stop());
    video.srcObject = null;
    video.classList.remove('active');
    videoPlaceholder.classList.remove('hidden');
    stream = null;
  }
  setStatus('', 'Offline');
  window.electron.stopCapture();
});

captureButton.addEventListener('click', () => {
  if (!video.srcObject) {
    setResult('error', 'Start the camera first before capturing.', 'error');
    return;
  }

  // Flash animation
  videoContainer.classList.remove('flash');
  void videoContainer.offsetWidth; // force reflow
  videoContainer.classList.add('flash');

  ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
  const imageData = canvas.toDataURL('image/jpeg');

  setStatus('processing', 'Analyzing...');
  setResult('info', 'Processing image...', 'waiting');

  sendImageToModel(imageData);
});

// ===== Manual Entry =====
waitButton.addEventListener('click', () => {
  const isVisible = manualPanel.classList.contains('visible');
  if (isVisible) {
    manualPanel.classList.remove('visible');
  } else {
    manualPanel.classList.add('visible');
    numInput.focus();
  }
});

enterButton.addEventListener('click', submitManualInput);
numInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') submitManualInput();
});

function submitManualInput() {
  const input = numInput.value.trim();
  if (!input) {
    setResult('error', 'Please enter a weight value.', 'error');
    return;
  }
  window.electron.waitInput(input);
  numInput.value = '';
  manualPanel.classList.remove('visible');
  setResult('success', `Manual input stored: ${input} kg`, 'success');
  updatePredCount();
}

// ===== Data Export =====
analyzeButton.addEventListener('click', () => {
  setResult('info', 'Saving Excel file...', 'waiting');
  window.electron.downloadExcel();
});

window.addEventListener('excel-downloaded', (e) => {
  if (e.detail.success) {
    setResult('success', 'Excel file saved successfully.', 'success');
  } else {
    setResult('', 'Export cancelled.', 'info');
  }
});

window.addEventListener('input-stored', (e) => {
  if (e.detail.success) {
    setResult('success', 'Input stored in log.', 'success');
  }
});

// ===== Model Prediction =====
async function sendImageToModel(imageData) {
  try {
    const { prediction: predictionText, error } = await window.electron.sendImage(imageData);
    if (error) {
      console.error('Error received from main process:', error);
      setStatus('active', 'Camera Live');
      setResult('error', `Detection failed: ${error}`, 'error');
    } else {
      console.log('Prediction received:', predictionText);
      setStatus('active', 'Camera Live');
      setResult('success', `Weight detected: ${predictionText}`, 'success');
      updatePredCount();
    }
  } catch (error) {
    console.error('Error sending image to model:', error);
    setStatus('active', 'Camera Live');
    setResult('error', 'Error communicating with detection server.', 'error');
  }
}
