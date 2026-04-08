#!/usr/bin/env node
/**
 * Build script to create a portable version of D212TaxHelper.
 * Downloads a portable Node.js binary and packages the entire app
 * into a self-contained folder with a Start.bat launcher.
 *
 * Usage: node build-portable.js
 */

const fs = require('fs');
const path = require('path');
const https = require('https');
const { execSync } = require('child_process');

const NODE_VERSION = 'v22.16.0'; // LTS version for portability
const NODE_ARCH = 'win-x64';
const NODE_ZIP = `node-${NODE_VERSION}-${NODE_ARCH}.zip`;
const NODE_URL = `https://nodejs.org/dist/${NODE_VERSION}/${NODE_ZIP}`;

const SRC = path.resolve(__dirname);
const DIST = path.resolve(__dirname, '..', 'D212TaxHelper-Portable');
const TEMP = path.resolve(__dirname, '..', '_portable_temp');

// Files/folders to copy from the app
const APP_ITEMS = [
  'server.js',
  'package.json',
  'package-lock.json',
  'public',
  'scripts',
  'LICENSE',
  'README.md',
  'CHANGELOG.en.md',
  'CHANGELOG.ro.md',
  'GUIDE.en.md',
  'GUIDE.ro.md',
];

// Traineddata files for Tesseract OCR
const TRAINEDDATA = ['eng.traineddata', 'ron.traineddata'];

function log(msg) { console.log(`  [build] ${msg}`); }

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
            process.stdout.write(`\r  [build] Download: ${pct}%  `);
          }
        });
        res.pipe(file);
        file.on('finish', () => {
          file.close();
          console.log('');
          resolve();
        });
      }).on('error', reject);
    };
    request(url);
  });
}

function copyRecursive(src, dest) {
  if (!fs.existsSync(src)) return;
  const stat = fs.statSync(src);
  if (stat.isDirectory()) {
    fs.mkdirSync(dest, { recursive: true });
    for (const item of fs.readdirSync(src)) {
      copyRecursive(path.join(src, item), path.join(dest, item));
    }
  } else {
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.copyFileSync(src, dest);
  }
}

async function build() {
  console.log('\n  === D212TaxHelper Portable Builder ===\n');

  // Clean previous build
  if (fs.existsSync(DIST)) {
    log('Removing previous build...');
    fs.rmSync(DIST, { recursive: true, force: true });
  }
  if (fs.existsSync(TEMP)) {
    fs.rmSync(TEMP, { recursive: true, force: true });
  }
  fs.mkdirSync(TEMP, { recursive: true });
  fs.mkdirSync(DIST, { recursive: true });

  // 1. Download Node.js portable
  const zipPath = path.join(TEMP, NODE_ZIP);
  if (!fs.existsSync(zipPath)) {
    await downloadFile(NODE_URL, zipPath);
  }

  // 2. Extract Node.js
  log('Extracting Node.js...');
  const nodeDir = path.join(DIST, 'node');
  fs.mkdirSync(nodeDir, { recursive: true });

  // Use PowerShell to extract
  execSync(
    `powershell -NoProfile -Command "Expand-Archive -Path '${zipPath}' -DestinationPath '${TEMP}' -Force"`,
    { stdio: 'pipe' }
  );

  // Move extracted folder contents into node/
  const extractedDir = path.join(TEMP, `node-${NODE_VERSION}-${NODE_ARCH}`);
  copyRecursive(extractedDir, nodeDir);

  // 3. Copy app files
  log('Copying application files...');
  const appDir = path.join(DIST, 'app');
  fs.mkdirSync(appDir, { recursive: true });

  for (const item of APP_ITEMS) {
    const srcPath = path.join(SRC, item);
    const destPath = path.join(appDir, item);
    if (fs.existsSync(srcPath)) {
      copyRecursive(srcPath, destPath);
      log(`  Copied ${item}`);
    }
  }

  // Copy traineddata files if present
  for (const td of TRAINEDDATA) {
    const srcPath = path.join(SRC, td);
    if (fs.existsSync(srcPath)) {
      fs.copyFileSync(srcPath, path.join(appDir, td));
      log(`  Copied ${td}`);
    }
  }

  // Ensure uploads folder exists
  fs.mkdirSync(path.join(appDir, 'uploads'), { recursive: true });

  // Create empty data folder with skeleton files (no personal data)
  const dataDir = path.join(appDir, 'data');
  fs.mkdirSync(dataDir, { recursive: true });
  fs.writeFileSync(path.join(dataDir, 'parsed_data.json'), JSON.stringify({ years: {} }, null, 2), 'utf8');
  fs.writeFileSync(path.join(dataDir, 'trades.json'), JSON.stringify({}, null, 2), 'utf8');
  fs.writeFileSync(path.join(dataDir, 'stock_awards.json'), JSON.stringify({ 'Stock Awards': [] }, null, 2), 'utf8');
  // Copy only pdf_metadata.json (document type definitions, no personal data)
  const metaSrc = path.join(SRC, 'data', 'pdf_metadata.json');
  if (fs.existsSync(metaSrc)) {
    fs.copyFileSync(metaSrc, path.join(dataDir, 'pdf_metadata.json'));
  }
  log('  Created empty data folder (no personal data)');

  // 4. Install production dependencies
  log('Installing production dependencies...');
  const npmPath = path.join(nodeDir, 'npm.cmd');
  const nodePath = path.join(nodeDir, 'node.exe');
  execSync(
    `"${nodePath}" "${path.join(nodeDir, 'node_modules', 'npm', 'bin', 'npm-cli.js')}" install --omit=dev`,
    { cwd: appDir, stdio: 'inherit', env: { ...process.env, PATH: nodeDir + ';' + process.env.PATH } }
  );

  // 5. Create Start.bat
  log('Creating launcher...');
  const startBat = `@echo off
set "PORTABLE_DIR=%~dp0"
set "NODE=%PORTABLE_DIR%node\\node.exe"
set "APP=%PORTABLE_DIR%app\\server.js"

cd /d "%PORTABLE_DIR%app"
powershell -WindowStyle Hidden -Command "Start-Process '%NODE%' -ArgumentList '%APP%' -WindowStyle Hidden -WorkingDirectory '%PORTABLE_DIR%app'"
timeout /t 2 /nobreak >nul
start http://localhost:3000
exit
`;
  fs.writeFileSync(path.join(DIST, 'Start.bat'), startBat, 'utf8');

  // 6. Create Stop.bat
  const stopBat = `@echo off
echo Stopping D212TaxHelper...
taskkill /f /im node.exe 2>nul
echo Done.
timeout /t 2 /nobreak >nul
`;
  fs.writeFileSync(path.join(DIST, 'Stop.bat'), stopBat, 'utf8');

  // 7. Create README
  const readme = `# D212TaxHelper - Portable

## Quick Start
1. Double-click **Start.bat** to launch the application
2. Your browser will open automatically at http://localhost:3000
3. To stop the server, close the command window or run **Stop.bat**

## Contents
- \`node/\` - Portable Node.js ${NODE_VERSION} runtime
- \`app/\` - Application files and data
- \`Start.bat\` - Launch the application
- \`Stop.bat\` - Stop the server

## Data
Your financial data is stored in \`app/data/\`. Back up this folder to preserve your data.

## Requirements
- Windows 10/11 (64-bit)
- No installation needed

## License
Licensed under [CC BY-NC 4.0](https://creativecommons.org/licenses/by-nc/4.0/). See \`app/LICENSE\` for details.
`;
  fs.writeFileSync(path.join(DIST, 'README.md'), readme, 'utf8');

  // Cleanup temp
  log('Cleaning up...');
  fs.rmSync(TEMP, { recursive: true, force: true });

  // Summary
  const size = getDirSize(DIST);
  console.log('\n  === Build Complete ===');
  console.log(`  Output: ${DIST}`);
  console.log(`  Size:   ${(size / 1024 / 1024).toFixed(1)} MB`);
  console.log(`  Run:    Start.bat\n`);
}

function getDirSize(dir) {
  let total = 0;
  for (const item of fs.readdirSync(dir)) {
    const p = path.join(dir, item);
    const stat = fs.statSync(p);
    total += stat.isDirectory() ? getDirSize(p) : stat.size;
  }
  return total;
}

build().catch(err => {
  console.error('\n  [ERROR]', err.message);
  process.exit(1);
});
