const https = require('https');
const fs = require('fs');
const path = require('path');
const AdmZip = require('adm-zip');

const SOX_VERSION = '14.4.2';
const SOX_URL = 'https://sourceforge.net/projects/sox/files/sox/14.4.2/sox-14.4.2-win32.zip';
const SOX_DIR = path.join(process.cwd(), `sox-${SOX_VERSION}`);
const ZIP_FILE = path.join(process.cwd(), `sox-${SOX_VERSION}.zip`);

async function downloadFile(url, dest) {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(dest);
    https.get(url, response => {
      response.pipe(file);
      file.on('finish', () => {
        file.close();
        resolve();
      });
    }).on('error', err => {
      fs.unlink(dest, () => reject(err));
    });
  });
}

async function setupSox() {
  try {
    console.log('Setting up Sox...');
    
    // Remove existing Sox directory if it exists
    if (fs.existsSync(SOX_DIR)) {
      console.log('Removing existing Sox installation...');
      fs.rmSync(SOX_DIR, { recursive: true, force: true });
    }

    // Download Sox
    console.log('Downloading Sox...');
    await downloadFile(SOX_URL, ZIP_FILE);
    
    // Extract Sox
    console.log('Extracting Sox...');
    const zip = new AdmZip(ZIP_FILE);
    zip.extractAllTo(process.cwd(), true);
    
    // Clean up zip file
    fs.unlinkSync(ZIP_FILE);
    
    // Verify installation
    if (fs.existsSync(path.join(SOX_DIR, 'sox.exe'))) {
      console.log('Sox installed successfully!');
      console.log('Location:', SOX_DIR);
    } else {
      throw new Error('Sox installation failed. sox.exe not found.');
    }
  } catch (error) {
    console.error('Error setting up Sox:', error);
    process.exit(1);
  }
}

setupSox(); 