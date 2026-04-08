#!/usr/bin/env node
/**
 * Setup script for PaddleOCR environment.
 * Downloads Python Embeddable (3.12) and installs PaddleOCR + dependencies.
 *
 * Usage: node setup_paddleocr.js [--target <dir>]
 *
 * This is used by build-portable.js for the "Full" build variant,
 * or can be run standalone for development setup.
 */

const fs = require('fs');
const path = require('path');
const https = require('https');
const { execSync } = require('child_process');

const PYTHON_VERSION = '3.12.8';
const PYTHON_ZIP = `python-${PYTHON_VERSION}-embed-amd64.zip`;
const PYTHON_URL = `https://www.python.org/ftp/python/${PYTHON_VERSION}/${PYTHON_ZIP}`;
const GET_PIP_URL = 'https://bootstrap.pypa.io/get-pip.py';

const PIP_PACKAGES = [
  'paddlepaddle==3.0.0',
  'paddleocr',
  'paddlex[ocr]',
  'pdf2image',
  'opencv-python-headless',
  'numpy',
  'Pillow',
];

function log(msg) { console.log(`  [paddleocr-setup] ${msg}`); }

function downloadFile(url, dest) {
  return new Promise((resolve, reject) => {
    log(`Downloading ${url} ...`);
    const file = fs.createWriteStream(dest);
    const request = (urlStr) => {
      https.get(urlStr, (res) => {
        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          request(res.headers.location);
          return;
        }
        if (res.statusCode !== 200) {
          reject(new Error(`HTTP ${res.statusCode} for ${urlStr}`));
          return;
        }
        const total = parseInt(res.headers['content-length'] || '0', 10);
        let downloaded = 0;
        res.on('data', (chunk) => {
          downloaded += chunk.length;
          if (total > 0) {
            const pct = ((downloaded / total) * 100).toFixed(0);
            process.stdout.write(`\r  [paddleocr-setup] Download: ${pct}%  `);
          }
        });
        res.pipe(file);
        file.on('finish', () => { file.close(); console.log(''); resolve(); });
      }).on('error', reject);
    };
    request(url);
  });
}

async function setup(targetDir) {
  const pythonDir = path.join(targetDir, 'python');
  const tempDir = path.join(targetDir, '_python_temp');

  log(`Setting up PaddleOCR in ${pythonDir}`);

  // Clean previous
  if (fs.existsSync(pythonDir)) {
    log('Removing previous Python installation...');
    fs.rmSync(pythonDir, { recursive: true, force: true });
  }
  fs.mkdirSync(pythonDir, { recursive: true });
  fs.mkdirSync(tempDir, { recursive: true });

  // 1. Download Python Embeddable
  const zipPath = path.join(tempDir, PYTHON_ZIP);
  if (!fs.existsSync(zipPath)) {
    await downloadFile(PYTHON_URL, zipPath);
  }

  // 2. Extract Python
  log('Extracting Python Embeddable...');
  execSync(
    `powershell -NoProfile -Command "Expand-Archive -Path '${zipPath}' -DestinationPath '${pythonDir}' -Force"`,
    { stdio: 'pipe' }
  );

  // 3. Enable pip: uncomment "import site" in python312._pth
  const pthFile = path.join(pythonDir, `python312._pth`);
  if (fs.existsSync(pthFile)) {
    let pth = fs.readFileSync(pthFile, 'utf8');
    pth = pth.replace(/^#\s*import site/m, 'import site');
    // Also add Lib\site-packages path
    if (!pth.includes('Lib\\site-packages')) {
      pth += '\nLib\\site-packages\n';
    }
    fs.writeFileSync(pthFile, pth, 'utf8');
    log('Enabled site-packages in ._pth file');
  }

  // 4. Download and run get-pip.py
  const getPipPath = path.join(tempDir, 'get-pip.py');
  if (!fs.existsSync(getPipPath)) {
    await downloadFile(GET_PIP_URL, getPipPath);
  }

  const pythonExe = path.join(pythonDir, 'python.exe');
  log('Installing pip...');
  execSync(`"${pythonExe}" "${getPipPath}" --no-warn-script-location`, {
    cwd: pythonDir,
    stdio: ['pipe', process.stdout, process.stderr],
  });

  // 5. Install PaddleOCR and dependencies
  log('Installing PaddleOCR packages (this may take several minutes)...');
  const pipCmd = `"${pythonExe}" -m pip install --no-warn-script-location ${PIP_PACKAGES.join(' ')}`;
  execSync(pipCmd, {
    cwd: pythonDir,
    stdio: ['pipe', process.stdout, process.stderr],
    timeout: 600000, // 10 min
  });

  // 6. Copy ocr_service.py into the python directory
  const ocrServiceSrc = path.join(__dirname, 'ocr_service.py');
  if (fs.existsSync(ocrServiceSrc)) {
    fs.copyFileSync(ocrServiceSrc, path.join(targetDir, 'ocr_service.py'));
    log('Copied ocr_service.py');
  }

  // 7. Verify installation
  log('Verifying PaddleOCR installation...');
  try {
    const verifyResult = execSync(
      `"${pythonExe}" -c "from paddleocr import PaddleOCR; print('OK')"`,

      { cwd: pythonDir, stdio: 'pipe', encoding: 'utf8' }
    );
    if (verifyResult.trim() === 'OK') {
      log('PaddleOCR verified successfully!');
    } else {
      log('WARNING: PaddleOCR verification returned unexpected output');
    }
  } catch (err) {
    log('WARNING: PaddleOCR verification failed: ' + err.message);
  }

  // Cleanup temp
  log('Cleaning up temp files...');
  fs.rmSync(tempDir, { recursive: true, force: true });

  log('PaddleOCR setup complete!');
  return pythonDir;
}

// CLI mode
if (require.main === module) {
  const args = process.argv.slice(2);
  let targetDir = __dirname;
  const targetIdx = args.indexOf('--target');
  if (targetIdx !== -1 && args[targetIdx + 1]) {
    targetDir = path.resolve(args[targetIdx + 1]);
  }
  setup(targetDir).catch(err => {
    console.error('\n  [ERROR]', err.message);
    process.exit(1);
  });
}

module.exports = { setup };
