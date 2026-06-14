const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const axios = require('axios');
const FormData = require('form-data');
const ExcelJS = require('exceljs');

let mainWindow;
let workbook = new ExcelJS.Workbook();
let worksheet = workbook.addWorksheet('Predictions');
worksheet.columns = [
  { header: 'Date', key: 'date' },
  { header: 'Time', key: 'time' },
  { header: 'Value', key: 'value' },
];

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
    console.log('Sending image to model...');
    const response = await sendImageToModel(imageData);
    const prediction = response.prediction;
    console.log('Prediction received:', prediction);
    const date = new Date();
    worksheet.addRow({
      date: date.toLocaleDateString(),
      time: date.toLocaleTimeString(),
      value: prediction,
    });

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

async function sendImageToModel(imageData) {
  const form = new FormData();
  form.append('file', Buffer.from(imageData.split(',')[1], 'base64'), {
    filename: 'image.jpg',
    contentType: 'image/jpeg',
  });

  try {
    const response = await axios.post('https://ideal-snapper-42.rshare.io/predict', form, {
      headers: form.getHeaders(),
    });
    return response.data;
  } catch (error) {
    console.error('Error sending image to model:', error);
    throw error;
  }
}
