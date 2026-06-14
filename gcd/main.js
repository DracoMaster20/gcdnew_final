const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs');
const { execFile } = require('child_process');
const ExcelJS = require('exceljs');

let mainWindow;
let workbook = new ExcelJS.Workbook();
let worksheet = workbook.addWorksheet('Predictions');
worksheet.columns = [
  { header: 'Date', key: 'date' },
  { header: 'Time', key: 'time' },
  { header: 'Value', key: 'value' },
];

const CAPTURES_DIR = path.join(__dirname, 'captures');
const PREDICT_SCRIPT = path.join(__dirname, 'predict_local.py');

// Ensure captures directory exists
if (!fs.existsSync(CAPTURES_DIR)) {
  fs.mkdirSync(CAPTURES_DIR, { recursive: true });
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1000,
    height: 680,
    minWidth: 800,
    minHeight: 500,
    backgroundColor: '#0d0f14',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
    }
  });

  mainWindow.loadFile('main.html');
}

app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

ipcMain.handle('send-image', async (event, imageData) => {
  try {
    console.log('Running local inference...');

    // Save the base64 image to a temp file
    const imgBuffer = Buffer.from(imageData.split(',')[1], 'base64');
    const imgPath = path.join(CAPTURES_DIR, 'electron_capture.jpg');
    fs.writeFileSync(imgPath, imgBuffer);

    // Run the local Python prediction script
    const result = await runPythonPredict(imgPath);

    console.log('Prediction result:', result);

    const prediction = result.prediction || result.error || 'Unknown';
    const date = new Date();
    worksheet.addRow({
      date: date.toLocaleDateString(),
      time: date.toLocaleTimeString(),
      value: prediction,
    });

    if (result.error) {
      return { error: result.error };
    }
    return { prediction };
  } catch (error) {
    console.error('Error in main process:', error);
    return { error: error.message };
  }
});

ipcMain.on('wait-input', async (event, input) => {
  const date = new Date();
  worksheet.addRow({
    date: date.toLocaleDateString(),
    time: date.toLocaleTimeString(),
    value: input,
  });
  event.reply('input-stored', { success: true });
});

ipcMain.on('download-excel', async (event) => {
  const result = await dialog.showSaveDialog({
    title: 'Save Excel File',
    defaultPath: 'predictions.xlsx',
    filters: [{ name: 'Excel Files', extensions: ['xlsx'] }],
  });

  if (!result.canceled) {
    await workbook.xlsx.writeFile(result.filePath);
    event.reply('excel-downloaded', { success: true });
  } else {
    event.reply('excel-downloaded', { success: false });
  }
});

ipcMain.on('stop-capture', (event) => {
  app.quit();
});

/**
 * Runs predict_local.py as a child process and returns the parsed JSON result.
 * Tries 'python3' first (Linux/macOS/Raspberry Pi), falls back to 'python' (Windows).
 */
function runPythonPredict(imagePath) {
  return new Promise((resolve, reject) => {
    const pythonCmd = process.platform === 'win32' ? 'python' : 'python3';

    execFile(pythonCmd, [PREDICT_SCRIPT, imagePath], {
      cwd: __dirname,
      timeout: 60000, // 60s timeout for model loading + inference
    }, (error, stdout, stderr) => {
      if (stderr) {
        console.warn('Python stderr:', stderr);
      }

      if (error) {
        // If python3 fails on Windows, it might not exist — but we already pick 'python'
        console.error('Python exec error:', error.message);
        reject(new Error(`Python inference failed: ${error.message}`));
        return;
      }

      try {
        const result = JSON.parse(stdout.trim());
        resolve(result);
      } catch (parseErr) {
        console.error('Failed to parse Python output:', stdout);
        reject(new Error('Invalid response from prediction script'));
      }
    });
  });
}
