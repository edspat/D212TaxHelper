const express = require('express');
const compression = require('compression');
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const pdfParse = require('pdf-parse-new');
const { execFile } = require('child_process');
const ledger = require('./ledger');
const db = require('./db');
let Tesseract = null; // lazy-loaded on first OCR use

// ============ PaddleOCR CONFIGURATION ============
const PADDLEOCR_SCRIPT = path.join(__dirname, 'ocr_service.py');
// Search for Python in portable layout first, then system PATH
const PYTHON_PATHS = [
  path.join(__dirname, 'python', 'python.exe'),       // portable (app/python/)
  path.join(__dirname, '..', 'python', 'python.exe'), // portable (python/ sibling)
  'python',                                            // system PATH
  'python3',                                           // system PATH (linux/mac)
];

let _paddleOcrAvailable = null; // cached detection result
let _pythonSizeMB = null; // cached python dir size (computed once)
let _upgradeInProgress = false; // true while PaddleOCR upgrade is running

function findPython() {
  for (const p of PYTHON_PATHS) {
    try {
      const resolved = path.isAbsolute(p) ? p : p;
      if (path.isAbsolute(p) && !fs.existsSync(p)) continue;
      require('child_process').execFileSync(resolved, ['--version'], { stdio: 'pipe', timeout: 5000, windowsHide: true });
      return resolved;
    } catch { /* try next */ }
  }
  return null;
}

function checkPaddleOcrAvailable() {
  if (_paddleOcrAvailable !== null) return _paddleOcrAvailable;
  // Synchronous fallback — only used if async detection hasn't completed yet
  return _checkPaddleOcrSync();
}

function _checkPaddleOcrSync() {
  if (!fs.existsSync(PADDLEOCR_SCRIPT)) {
    _paddleOcrAvailable = { available: false, reason: 'ocr_service.py not found' };
    return _paddleOcrAvailable;
  }

  const pythonExe = findPython();
  if (!pythonExe) {
    _paddleOcrAvailable = { available: false, reason: 'Python not found' };
    return _paddleOcrAvailable;
  }

  try {
    require('child_process').execFileSync(pythonExe, ['-c', 'from paddleocr import PaddleOCR; print("OK")'], {
      stdio: 'pipe', timeout: 30000, windowsHide: true,
      env: { ...process.env, PADDLE_PDX_DISABLE_MODEL_SOURCE_CHECK: 'True', GLOG_minloglevel: '2' }
    });
    _paddleOcrAvailable = { available: true, python: pythonExe };
  } catch (err) {
    _paddleOcrAvailable = { available: false, reason: 'PaddleOCR not installed', python: pythonExe };
  }

  return _paddleOcrAvailable;
}

// Async detection — runs in background, doesn't block server startup
function detectPaddleOcrAsync() {
  if (!fs.existsSync(PADDLEOCR_SCRIPT)) {
    _paddleOcrAvailable = { available: false, reason: 'ocr_service.py not found' };
    return;
  }
  const pythonExe = findPython();
  if (!pythonExe) {
    _paddleOcrAvailable = { available: false, reason: 'Python not found' };
    return;
  }
  const { execFile } = require('child_process');
  execFile(pythonExe, ['-c', 'from paddleocr import PaddleOCR; print("OK")'], {
    timeout: 30000, windowsHide: true,
    env: { ...process.env, PADDLE_PDX_DISABLE_MODEL_SOURCE_CHECK: 'True', GLOG_minloglevel: '2' }
  }, (err) => {
    if (err) {
      _paddleOcrAvailable = { available: false, reason: 'PaddleOCR not installed', python: pythonExe };
    } else {
      _paddleOcrAvailable = { available: true, python: pythonExe };
    }
    log('INFO', 'OCR engine detection', {
      paddleocr: _paddleOcrAvailable.available,
      detail: _paddleOcrAvailable.reason || 'ready',
      python: _paddleOcrAvailable.python || null,
    });
    console.log(`  OCR Engine: ${_paddleOcrAvailable.available ? 'PaddleOCR (PP-StructureV3)' : 'Tesseract.js (PaddleOCR not available: ' + (_paddleOcrAvailable.reason || 'unknown') + ')'}`);
  });
}

function runPaddleOcr(filePath, mode = 'auto') {
  return new Promise((resolve, reject) => {
    const status = checkPaddleOcrAvailable();
    if (!status.available) {
      return reject(new Error('PaddleOCR not available: ' + status.reason));
    }

    const args = [PADDLEOCR_SCRIPT, filePath, '--mode', mode];

    execFile(status.python, args, {
      timeout: 120000, // 2 min per document
      maxBuffer: 50 * 1024 * 1024, // 50 MB for large table results
      cwd: __dirname,
      windowsHide: true,
      env: { ...process.env, PADDLE_PDX_DISABLE_MODEL_SOURCE_CHECK: 'True', GLOG_minloglevel: '2' },
    }, (err, stdout, stderr) => {
      if (err) {
        log('ERROR', 'PaddleOCR subprocess failed', { error: err.message, stderr });
        return reject(err);
      }
      try {
        const result = JSON.parse(stdout);
        if (result.error) {
          return reject(new Error(result.error));
        }
        resolve(result);
      } catch (parseErr) {
        log('ERROR', 'PaddleOCR JSON parse failed', { stdout: stdout.slice(0, 500) });
        reject(new Error('Failed to parse PaddleOCR output'));
      }
    });
  });
}

const ALLOWED_MIMES = new Set([
  'application/pdf',
  'image/jpeg', 'image/png', 'image/gif', 'image/bmp',
  'image/tiff', 'image/webp'
]);
const IMAGE_MIMES = new Set([
  'image/jpeg', 'image/png', 'image/gif', 'image/bmp',
  'image/tiff', 'image/webp'
]);

const app = express();
const PORT = process.env.PORT || 3000;
const DATA_DIR = path.join(__dirname, 'data');
const UPLOADS_DIR = path.join(__dirname, 'uploads');
const LOGS_DIR = path.join(__dirname, 'logs');

// Ensure directories exist
[DATA_DIR, UPLOADS_DIR, LOGS_DIR].forEach(dir => {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
});

// ============ FILE LOGGER ============
const logFile = path.join(LOGS_DIR, `app_${new Date().toISOString().slice(0, 10)}.log`);
function log(level, msg, meta) {
  const ts = new Date().toISOString();
  const entry = `[${ts}] [${level}] ${msg}${meta ? ' | ' + JSON.stringify(meta) : ''}\n`;
  fs.appendFileSync(logFile, entry);
  if (level === 'ERROR') console.error(entry.trim());
}
log('INFO', 'Server starting', { pid: process.pid, node: process.version, cwd: __dirname });

// Detect PaddleOCR availability at startup (non-blocking async)
detectPaddleOcrAsync();

process.on('uncaughtException', (err) => {
  log('ERROR', 'Uncaught exception: ' + err.message, { stack: err.stack });
  // Don't exit for Tesseract/OCR errors — they happen in worker threads
  if (err.message && err.message.includes('Error attempting to read image')) {
    log('ERROR', 'OCR worker error — server continues running');
    return;
  }
  process.exit(1);
});
process.on('unhandledRejection', (reason) => {
  log('ERROR', 'Unhandled rejection: ' + String(reason));
});
process.on('SIGINT', () => { log('INFO', 'Server stopped (SIGINT)'); process.exit(0); });
process.on('SIGTERM', () => { log('INFO', 'Server stopped (SIGTERM)'); process.exit(0); });
process.on('exit', (code) => { try { fs.appendFileSync(logFile, `[${new Date().toISOString()}] [INFO] Process exit with code ${code}\n`); } catch {} });

// Middleware
app.use(compression());
app.use(express.json());
app.use((req, res, next) => {
  if (req.path.startsWith('/api')) log('INFO', `${req.method} ${req.path}`, req.method === 'POST' ? { type: req.query.type || req.body?.type } : undefined);
  next();
});
app.use(express.static(path.join(__dirname, 'public'), {
  maxAge: 0,
  setHeaders: (res, filePath) => {
    if (filePath.endsWith('.json') || filePath.endsWith('.js') || filePath.endsWith('.css') || filePath.endsWith('.html')) {
      res.setHeader('Cache-Control', 'no-cache');
    }
  }
}));

// File upload config - accept PDFs and images
const upload = multer({
  dest: UPLOADS_DIR,
  limits: { fileSize: 20 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (ALLOWED_MIMES.has(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Only PDF and image files (JPG, PNG, GIF, BMP, TIFF, WebP) are allowed'));
    }
  }
});

// ============ API ROUTES ============

// Compute python dir size once (async, non-blocking)
function computePythonSizeMB() {
  const pythonDir = path.join(__dirname, 'python');
  if (!fs.existsSync(pythonDir)) { _pythonSizeMB = null; return; }
  try {
    let total = 0;
    const walk = (dir) => {
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const p = path.join(dir, entry.name);
        if (entry.isDirectory()) walk(p);
        else total += fs.statSync(p).size;
      }
    };
    walk(pythonDir);
    _pythonSizeMB = Math.round(total / (1024 * 1024));
  } catch { _pythonSizeMB = null; }
}
// Compute at startup in next tick so it doesn't block server start
setImmediate(computePythonSizeMB);

// GET /api/ocr-status - Return OCR engine availability
app.get('/api/ocr-status', (req, res) => {
  // Recompute python size live during upgrade so progress bar works
  if (_upgradeInProgress) computePythonSizeMB();
  // If async detection hasn't completed yet, return "detecting" status
  if (_paddleOcrAvailable === null) {
    return res.json({
      paddleocr: false,
      paddleocrDetail: 'Detecting...',
      tesseract: true,
      engine: 'tesseract',
      pythonSizeMB: _pythonSizeMB,
      detecting: true,
    });
  }
  const paddle = _paddleOcrAvailable;
  res.json({
    paddleocr: paddle.available,
    paddleocrDetail: paddle.reason || null,
    tesseract: true, // always available (bundled via tesseract.js)
    engine: paddle.available ? 'paddleocr' : 'tesseract',
    pythonSizeMB: _pythonSizeMB,
  });
});

// GET /api/data - Return all financial data
app.get('/api/data', (req, res) => {
  try {
    const data = { years: db.getAllYears() };

    // Also load stock awards
    const awards = db.getAllStockAwards();
    if (awards.length > 0) {
      data.stockAwards = { 'Stock Awards': awards };
    }

    // Load metadata if available
    const metaFile = path.join(DATA_DIR, 'pdf_metadata.json');
    if (fs.existsSync(metaFile)) {
      data.metadata = JSON.parse(fs.readFileSync(metaFile, 'utf8'));
    }

    res.json(data);
  } catch (err) {
    log('ERROR', 'GET /api/data failed', { error: err.message });
    res.status(500).json({ error: err.message });
  }
});

// GET /api/data/:year - Return data for specific year
app.get('/api/data/:year', (req, res) => {
  try {
    const year = parseInt(req.params.year, 10);
    if (isNaN(year) || year < 2000 || year > 2100) {
      return res.status(400).json({ error: 'Invalid year' });
    }
    res.json(db.getYearData(year));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/data/:year - Update data for a specific year
app.put('/api/data/:year', (req, res) => {
  try {
    const year = parseInt(req.params.year, 10);
    if (isNaN(year) || year < 2000 || year > 2100) {
      return res.status(400).json({ error: 'Invalid year' });
    }
    const merged = db.mergeYearData(year, req.body);

    // Save a raw text file for manual data (visible in Raw Data tab)
    const manualFields = [
      'usBroker', 'roBroker', 'fidelityDividends', 'usDivTaxPaid',
      'xtbDividends', 'roDivTaxPaid', 'fidelityGains', 'fidelityCost',
      'interestIncome', 'rentalIncome', 'rentalTaxPaid', 'royaltyIncome',
      'royaltyTaxPaid', 'gamblingIncome', 'gamblingTaxPaid', 'otherIncome',
      'otherTaxPaid', 'stockWithholdingPaid', 'exchangeRate', 'minSalary',
      'd212Deadline', 'roGainsCountries'
    ];
    const hasManualData = manualFields.some(f => {
      const v = req.body[f];
      if (f === 'roGainsCountries') return Array.isArray(v) && v.length > 0;
      return v !== undefined && v !== '' && v !== null;
    });
    if (hasManualData) {
      const lines = [`Manual Data — Year ${year}`, `Saved: ${new Date().toISOString()}`, ''];
      for (const f of manualFields) {
        const v = req.body[f];
        if (v === undefined || v === '' || v === null) continue;
        if (f === 'roGainsCountries' && Array.isArray(v)) {
          lines.push(`${f}:`);
          for (const c of v) {
            lines.push(`  ${c.country || '?'}\t≥1yr: ${c.longGain || 0}\t<1yr: ${c.shortGain || 0}\tTax: ${c.taxWithheld || 0}`);
          }
        } else {
          lines.push(`${f}\t${v}`);
        }
      }
      const rawFile = path.join(DATA_DIR, `manual_data_${year}_raw.txt`);
      fs.writeFileSync(rawFile, lines.join('\n'), 'utf8');
    }

    res.json({ success: true, data: merged });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/raw - List available raw files with metadata
app.get('/api/raw', (req, res) => {
  try {
    const files = fs.readdirSync(DATA_DIR).filter(f => f.endsWith('_raw.txt')).sort();
    const result = files.map(f => {
      const stat = fs.statSync(path.join(DATA_DIR, f));
      return { name: f, date: stat.mtime.toISOString(), size: stat.size };
    });
    res.json(result);
  } catch (err) {
    res.json([]);
  }
});

// DELETE /api/raw/:filename - Delete a raw file and its parsed data
app.delete('/api/raw/:filename', (req, res) => {
  try {
    const safeName = path.basename(req.params.filename);
    if (!safeName.endsWith('_raw.txt')) {
      return res.status(400).json({ error: 'Invalid filename' });
    }
    const filePath = path.join(DATA_DIR, safeName);
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: 'File not found' });
    }
    // Delete the raw file
    fs.unlinkSync(filePath);

    // Also remove related parsed data
    const baseName = safeName.replace('_raw.txt', '');
    const parts = baseName.match(/^(.+)_(\d{4})$/);
    if (parts) {
      const type = parts[1];
      const year = parseInt(parts[2], 10);
      const yearData = db.getYearData(year);
      if (yearData) {
        // Remove matching type from year data
        delete yearData[type];

        // Handle special naming conventions
        if (type === 'manual_data') {
          const manualKeys = [
            'usBroker', 'roBroker', 'fidelityDividends', 'usDivTaxPaid',
            'xtbDividends', 'roDivTaxPaid', 'fidelityGains', 'fidelityCost',
            'interestIncome', 'interestTaxPaid', 'rentalIncome', 'rentalTaxPaid', 'royaltyIncome',
            'royaltyTaxPaid', 'gamblingIncome', 'gamblingTaxPaid', 'otherIncome',
            'otherTaxPaid', 'stockWithholdingPaid', 'salaryTaxedIncome', 'exchangeRate', 'minSalary',
            'd212Deadline', 'roGainsCountries', 'taxRates'
          ];
          for (const k of manualKeys) {
            delete yearData[k];
          }
        }
        if (type === 'xtb_dividends') delete yearData.xtbDividendsReport;
        if (type === 'xtb_portfolio') delete yearData.xtbPortfolio;
        if (type === 'tradeville_portfolio') delete yearData.tradevillePortfolio;
        if (type === 'ms_statement') {
          delete yearData.msStatement;
          delete yearData.msDividends;
          delete yearData.msTaxWithheld;
          delete yearData.fidelityTrades;
        }
        if (type === 'fidelity_statement') {
          delete yearData.fidelityTrades;
          delete yearData.fidelityVests;
          delete yearData.fidelityDividendsYTD;
          delete yearData.fidelityTaxWithheldYTD;
          delete yearData.fidelityRealizedGainYTD;
          delete yearData.fidelityLongTermGainYTD;
          delete yearData.fidelityShortTermGainYTD;
          delete yearData.fidelitySalesCostBasisUSD;
        }
        if (type === 'form_1042s') delete yearData.form1042s;
        if (type === 'trade_confirmation') delete yearData.fidelityTrades;

        // Remove ALL stock awards when stock_award raw file is purged
        if (type === 'stock_award') {
          db.clearStockAwards();
          // Also purge all vests from ledger
          const ldg = ledger.load();
          let deleted = 0;
          for (const entry of ldg.entries) {
            if (entry.type === 'stock_vest' && !entry.deleted) {
              entry.deleted = true;
              deleted++;
            }
          }
          if (deleted > 0) {
            ledger.recalculateAllocations(ldg);
            ledger.save(ldg);
          }
        }

        // Clear trades based on source
        if (type === 'trade_confirmation' || type === 'ms_statement' || type === 'fidelity_statement') {
          if (type === 'ms_statement') {
            db.deleteTradesBySource('ms_statement');
          } else if (type === 'fidelity_statement') {
            db.deleteTradesBySource('fidelity_statement');
          } else {
            db.deleteTradesExceptSource('ms_statement');
          }

          // Recalculate fidelityTrades aggregate for this year
          const yearTrades = db.getTradesByYear(year);
          if (yearTrades.length > 0) {
            const ySales = yearTrades.filter(t => t.transactionType !== 'purchase');
            const yPurchases = yearTrades.filter(t => t.transactionType === 'purchase');
            yearData.fidelityTrades = {
              count: ySales.length,
              totalProceeds: ySales.reduce((s, t) => s + (t.saleProceeds || 0), 0),
              totalFees: ySales.reduce((s, t) => s + (t.fees || 0), 0),
              totalNet: ySales.reduce((s, t) => s + (t.netProceeds || 0), 0),
              totalShares: ySales.reduce((s, t) => s + (t.shares || 0), 0),
              purchases: yPurchases.length,
              totalEsppGain: yPurchases.reduce((s, t) => s + (t.esppGain || 0), 0),
              totalEsppContributions: yPurchases.reduce((s, t) => s + (t.accumulatedContributions || 0), 0),
              totalEsppShares: yPurchases.reduce((s, t) => s + (t.shares || 0), 0),
              trades: yearTrades
            };
          } else {
            delete yearData.fidelityTrades;
          }

          // Also purge from ledger
          ledger.purgeBySourceFile(safeName);
        }

        // Clean up empty year objects or save updated data
        if (Object.keys(yearData).filter(k => k !== 'year').length === 0) {
          db.deleteYear(year);
        } else {
          db.setYearData(year, yearData);
        }
      }
    }

    res.json({ success: true, deleted: safeName });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/raw/:filename - Return raw extracted text
app.get('/api/raw/:filename', (req, res) => {
  const safeName = path.basename(req.params.filename);
  if (!safeName.endsWith('_raw.txt')) {
    return res.status(400).json({ error: 'Invalid filename' });
  }
  const filePath = path.join(DATA_DIR, safeName);
  if (!fs.existsSync(filePath)) {
    return res.status(404).json({ error: 'File not found' });
  }
  res.type('text/plain').send(fs.readFileSync(filePath, 'utf8'));
});

// PUT /api/raw/:filename - Update raw file content
app.put('/api/raw/:filename', (req, res) => {
  try {
    const safeName = path.basename(req.params.filename);
    if (!safeName.endsWith('_raw.txt')) {
      return res.status(400).json({ error: 'Invalid filename' });
    }
    const filePath = path.join(DATA_DIR, safeName);
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: 'File not found' });
    }
    const { content } = req.body;
    if (typeof content !== 'string') {
      return res.status(400).json({ error: 'Content must be a string' });
    }
    fs.writeFileSync(filePath, content, 'utf8');
    res.json({ success: true, saved: safeName });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/upload - Upload and process a PDF or image
app.post('/api/upload', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }
    const { year, type } = req.body;
    const parsedYear = parseInt(year, 10);
    if (isNaN(parsedYear) || parsedYear < 2000 || parsedYear > 2100) {
      fs.unlinkSync(req.file.path);
      return res.status(400).json({ error: 'Invalid year' });
    }
    const validTypes = ['declaratie', 'investment', 'adeverinta', 'stock_award', 'trade_confirmation', 'xtb_dividends', 'xtb_portfolio', 'form_1042s', 'ms_statement', 'tradeville_portfolio', 'fidelity_statement'];
    if (!validTypes.includes(type)) {
      fs.unlinkSync(req.file.path);
      return res.status(400).json({ error: 'Invalid type. Must be: ' + validTypes.join(', ') });
    }

    // Extract text from PDF or image (OCR)
    const buffer = fs.readFileSync(req.file.path);
    let text;
    let usedOcrFallback = false;
    let ocrEngine = 'pdf-parse'; // track which engine produced the text
    let paddleResult = null; // store full PaddleOCR result for table-aware parsers
    const isImage = IMAGE_MIMES.has(req.file.mimetype);

    // PaddleOCR needs a file with the correct extension to detect format
    const mimeToExt = { 'application/pdf': '.pdf', 'image/jpeg': '.jpg', 'image/png': '.png', 'image/gif': '.gif', 'image/bmp': '.bmp', 'image/tiff': '.tiff', 'image/webp': '.webp' };
    const ext = mimeToExt[req.file.mimetype] || '';
    const paddleFilePath = req.file.path + ext;
    if (ext && !req.file.path.endsWith(ext)) {
      fs.copyFileSync(req.file.path, paddleFilePath);
    }

    // Types that benefit from PaddleOCR table extraction (scanned PDFs with complex tables)
    const TABLE_TYPES = ['tradeville_portfolio', 'declaratie', 'ms_statement'];
    const preferPaddleOcr = TABLE_TYPES.includes(type);
    const paddleStatus = checkPaddleOcrAvailable();

    if (isImage) {
      // For images: try PaddleOCR first if available, else Tesseract
      if (paddleStatus.available) {
        try {
          paddleResult = await runPaddleOcr(paddleFilePath, preferPaddleOcr ? 'auto' : 'text');
          text = paddleResult.combinedText || paddleResult.text || '';
          ocrEngine = 'paddleocr';
          log('INFO', 'PaddleOCR extracted text from image', { chars: text.length });
        } catch (paddleErr) {
          log('ERROR', 'PaddleOCR failed for image, falling back to Tesseract', { error: paddleErr.message });
        }
      }
      if (!text) {
        if (!Tesseract) Tesseract = require('tesseract.js');
        const { data } = await Tesseract.recognize(buffer, 'eng+ron');
        text = data.text;
        ocrEngine = 'tesseract';
      }
    } else {
      // For PDFs: extract text first, then OCR if needed
      const pdfData = await pdfParse(buffer);
      text = pdfData.text;

      // Check if PDF is image-based (scanned), XFA dynamic form, or has very little text
      const isXfaPlaceholder = /Please wait[\s\S]*?Adobe Reader/i.test(text);

      // For ANAF D-212 XFA PDFs: extract embedded XML data directly (no OCR needed)
      if (isXfaPlaceholder && type === 'declaratie') {
        const xmlData = extractAnafD212Xml(buffer);
        if (xmlData) {
          log('INFO', 'Extracted ANAF D-212 data from embedded XML');
          // Save raw XML for reference
          const rawFile = `${type}_${parsedYear}_raw.txt`;
          fs.writeFileSync(path.join(DATA_DIR, rawFile), '[ANAF D-212 XML]\n' + JSON.stringify(xmlData, null, 2), 'utf8');
          // Clean up
          fs.unlinkSync(req.file.path);
          if (paddleFilePath !== req.file.path && fs.existsSync(paddleFilePath)) fs.unlinkSync(paddleFilePath);
          // Store parsed data
          db.mergeYearData(parsedYear, { [type]: xmlData });
          return res.json({ success: true, year: parsedYear, type, parsed: xmlData, ocrEngine: 'xml' });
        }
        // If XML extraction failed, fall through to OCR
        log('WARN', 'ANAF D-212 XML extraction failed, trying OCR...');
      }

      if (text.replace(/\s/g, '').length < 50 || isXfaPlaceholder) {
        if (isXfaPlaceholder) {
          log('INFO', 'PDF is an XFA/dynamic form (ANAF D-212 style), falling back to OCR...');
          console.log('PDF is an XFA/dynamic form (ANAF style), falling back to OCR...');
        } else {
          console.log('PDF appears to be image-based (extracted only ' + text.trim().length + ' chars), falling back to OCR...');
        }

        // Try PaddleOCR first for scanned PDFs (superior table extraction)
        if (paddleStatus.available) {
          try {
            paddleResult = await runPaddleOcr(paddleFilePath, preferPaddleOcr ? 'auto' : 'text');
            text = paddleResult.combinedText || paddleResult.text || '';
            ocrEngine = 'paddleocr';
            usedOcrFallback = true;
            log('INFO', 'PaddleOCR extracted text from scanned PDF', { chars: text.length });
          } catch (paddleErr) {
            log('ERROR', 'PaddleOCR failed for PDF, trying Tesseract', { error: paddleErr.message });
          }
        }

        // Fall back to Tesseract if PaddleOCR didn't produce results
        if (!text || text.replace(/\s/g, '').length < 50) {
          try {
            if (!Tesseract) Tesseract = require('tesseract.js');
            const { data } = await Tesseract.recognize(buffer, 'eng+ron');
            text = data.text;
            ocrEngine = 'tesseract';
            usedOcrFallback = true;
          } catch (ocrErr) {
            log('ERROR', 'OCR fallback failed', { error: ocrErr.message });
            // Continue with whatever text we have
          }
        }
      } else if (preferPaddleOcr && paddleStatus.available && !/FORMULAR VALIDAT/i.test(text)) {
        // Even for text-based PDFs, run PaddleOCR in table mode for table-heavy documents
        // Skip for ANAF D-212 rendered PDFs — their text layer is sufficient
        try {
          paddleResult = await runPaddleOcr(paddleFilePath, 'table');
          log('INFO', 'PaddleOCR table extraction on text PDF');
          // Keep original pdf-parse text but add table data
        } catch (paddleErr) {
          log('ERROR', 'PaddleOCR table extraction failed (non-critical)', { error: paddleErr.message });
        }
      }
    }

    // If OCR fallback was used, check quality for generic document types
    // Types with their own quality checks (tradeville, trade_confirmation, fidelity, etc.) are handled downstream
    const SELF_VALIDATED_TYPES = ['tradeville_portfolio', 'trade_confirmation', 'form_1042s', 'ms_statement', 'xtb_dividends', 'xtb_portfolio', 'stock_award', 'fidelity_statement'];
    if (usedOcrFallback && !SELF_VALIDATED_TYPES.includes(type)) {
      const realizatMatches = text.match(/Realizat\s+\d+/gi) || [];
      if (realizatMatches.length === 0) {
        console.log('OCR quality too low - no parseable data rows found. Asking user to enter manually.');
        // Still save raw OCR text for reference
        const rawFile = `${type}_${parsedYear}_raw.txt`;
        fs.writeFileSync(path.join(DATA_DIR, rawFile), '[OCR - low quality]\n' + text, 'utf8');
        fs.unlinkSync(req.file.path);
        if (paddleFilePath !== req.file.path && fs.existsSync(paddleFilePath)) fs.unlinkSync(paddleFilePath);
        // Extract category hints from OCR text for user guidance
        const categories = [];
        if (/dobanzi/i.test(text)) categories.push('Venituri din dobânzi');
        if (/jocuri|noroc/i.test(text)) categories.push('Venituri din jocuri de noroc');
        if (/salarial/i.test(text)) categories.push('Venituri salariale');
        return res.json({
          success: false,
          ocrLowQuality: true,
          year: parsedYear,
          type,
          categories,
          message: 'OCR quality too low to extract numbers. Please enter data manually.'
        });
      }
    }

    // Save raw text (append for trade confirmations and fidelity statements, overwrite for others)
    const rawFile = `${type}_${parsedYear}_raw.txt`;
    const rawPath = path.join(DATA_DIR, rawFile);
    if (type === 'trade_confirmation' && fs.existsSync(rawPath)) {
      fs.appendFileSync(rawPath, '\n\n--- NEW TRADE CONFIRMATION ---\n\n' + text, 'utf8');
    } else if (type === 'fidelity_statement' && fs.existsSync(rawPath)) {
      fs.appendFileSync(rawPath, '\n\n--- NEW FIDELITY STATEMENT ---\n\n' + text, 'utf8');
    } else {
      fs.writeFileSync(rawPath, text, 'utf8');
    }

    // Clean up uploaded file (and PaddleOCR extension copy if created)
    fs.unlinkSync(req.file.path);
    if (paddleFilePath !== req.file.path && fs.existsSync(paddleFilePath)) {
      fs.unlinkSync(paddleFilePath);
    }

    // Stock award documents get special handling (append, not overwrite)
    if (type === 'stock_award') {
      const stockData = parseStockAward(text, parsedYear);
      // Dedup: skip rows with same datastat date already present
      let added = 0, skipped = 0;
      for (const row of stockData.rows) {
        if (db.addStockAward(row)) {
          added++;
        } else {
          skipped++;
        }
      }
      const totalRows = db.getAllStockAwards().length;
      // Also add to ledger for persistent tracking
      const ledgerResult = ledger.addVestEntries(stockData.rows, rawFile);
      return res.json({ success: true, year: parsedYear, type, parsed: stockData, added, skipped, totalRows, ledger: ledgerResult });
    }

    // Trade confirmations get appended (multiple files per year)
    if (type === 'trade_confirmation') {
      const trade = parseTradeConfirmation(text, parsedYear);
      // Avoid duplicates by checking ref number
      const isDuplicate = trade.refNumber ? !db.addTrade(trade) : false;
      if (!isDuplicate && !trade.refNumber) {
        db.addTrade(trade);
      }
      // Aggregate trades for this year (separate sales from purchases)
      const yearTrades = db.getTradesByYear(parsedYear);
      const yearSales = yearTrades.filter(t => t.transactionType !== 'purchase');
      const yearPurchases = yearTrades.filter(t => t.transactionType === 'purchase');
      const fidelityTrades = {
        count: yearSales.length,
        totalProceeds: yearSales.reduce((s, t) => s + (t.saleProceeds || 0), 0),
        totalFees: yearSales.reduce((s, t) => s + (t.fees || 0), 0),
        totalNet: yearSales.reduce((s, t) => s + (t.netProceeds || 0), 0),
        totalShares: yearSales.reduce((s, t) => s + (t.shares || 0), 0),
        purchases: yearPurchases.length,
        totalEsppGain: yearPurchases.reduce((s, t) => s + (t.esppGain || 0), 0),
        totalEsppContributions: yearPurchases.reduce((s, t) => s + (t.accumulatedContributions || 0), 0),
        totalEsppShares: yearPurchases.reduce((s, t) => s + (t.shares || 0), 0),
        trades: yearTrades
      };
      db.mergeYearData(parsedYear, { fidelityTrades });
      // Also add to ledger for persistent tracking
      ledger.addTrade(trade, rawFile);
      const ledgerAlloc = ledger.getAllocations(parsedYear);
      return res.json({ success: true, year: parsedYear, type, parsed: trade, isDuplicate, yearSummary: fidelityTrades, ledgerAllocations: ledgerAlloc });
    }

    // XTB Dividends & Interest report
    if (type === 'xtb_dividends') {
      const parsed = parseXtbDividends(text, parsedYear);
      db.mergeYearData(parsedYear, { xtbDividendsReport: parsed });
      return res.json({ success: true, year: parsedYear, type, parsed });
    }

    // XTB Portfolio (Capital Gains)
    if (type === 'xtb_portfolio') {
      const parsed = parseXtbPortfolio(text, parsedYear);
      db.mergeYearData(parsedYear, { xtbPortfolio: parsed });
      return res.json({ success: true, year: parsedYear, type, parsed });
    }

    // Form 1042-S (US tax withholding on foreign person's income)
    if (type === 'form_1042s') {
      const parsed = parseForm1042S(text, parsedYear);
      const yearData = db.getYearData(parsedYear) || { year: parsedYear };
      if (!yearData.form1042s) yearData.form1042s = [];
      // Dedup by unique form identifier
      const isDuplicate = parsed.uniqueFormId && yearData.form1042s.some(f => f.uniqueFormId === parsed.uniqueFormId);
      if (!isDuplicate) {
        yearData.form1042s.push(parsed);
      }
      db.setYearData(parsedYear, yearData);
      return res.json({ success: true, year: parsedYear, type, parsed, isDuplicate });
    }

    // Morgan Stanley Stock Plan Statement (yearly)
    if (type === 'ms_statement') {
      const parsed = parseMSStatement(text, parsedYear);

      // Add sales as trades (dedup by date + shares + netProceeds)
      let newTradesAdded = 0;
      let duplicatesSkipped = 0;
      for (const sale of parsed.sales) {
        if (db.addTradeIfNotDuplicate(sale)) {
          newTradesAdded++;
        } else {
          duplicatesSkipped++;
        }
      }

      // Build year data update
      const msUpdate = {
        msStatement: {
          period: parsed.period,
          dividends: parsed.dividends,
          taxWithheld: parsed.taxWithheld,
          releases: parsed.releases,
          closingValue: parsed.closingValue,
          closingShares: parsed.closingShares
        }
      };

      // Update dividends if present
      if (parsed.dividends > 0) {
        msUpdate.msDividends = parsed.dividends;
        msUpdate.msTaxWithheld = parsed.taxWithheld;
      }

      // Recalculate trade aggregates (include MS trades)
      const yearTrades = db.getTradesByYear(parsedYear);
      msUpdate.fidelityTrades = {
        count: yearTrades.length,
        totalProceeds: yearTrades.reduce((s, t) => s + (t.saleProceeds || 0), 0),
        totalFees: yearTrades.reduce((s, t) => s + (t.fees || 0), 0),
        totalNet: yearTrades.reduce((s, t) => s + (t.netProceeds || 0), 0),
        totalShares: yearTrades.reduce((s, t) => s + (t.shares || 0), 0),
        trades: yearTrades
      };

      db.mergeYearData(parsedYear, msUpdate);
      // Also add to ledger
      ledger.addMSTrades(parsed.sales, rawFile);
      return res.json({
        success: true, year: parsedYear, type, parsed,
        newTradesAdded, duplicatesSkipped,
        totalTrades: yearTrades.length
      });
    }

    // Fidelity Stock Plan monthly statement (sales with cost basis, vests, ESPP, dividends, tax)
    if (type === 'fidelity_statement') {
      const parsed = parseFidelityStatement(text, parsedYear);

      // Check for empty/initial statement (Beginning/Ending Account Value are dashes)
      const isEmptyStatement = /(?:Beginning|Ending)\s+Account\s+Value\s*\*{0,2}\s*-\s*-/i.test(text)
        && parsed.sales.length === 0 && parsed.vests.length === 0 && parsed.esppPurchases.length === 0;

      if (isEmptyStatement) {
        return res.json({
          success: false,
          ocrLowQuality: true,
          year: parsedYear,
          type,
          messageKey: 'import.ocrFidelityStatementEmpty'
        });
      }

      // Validate: check if MSFT data was found
      if (parsed.sales.length === 0 && parsed.vests.length === 0 && parsed.dividends.length === 0 && parsed.esppPurchases.length === 0 && parsed.dividendsYTD === 0) {
        // Check if it's a valid statement with no MSFT activity (vs. unparseable)
        const hasValidPeriod = parsed.period && parsed.period.length > 5;
        const hasAccountValue = /Stock Plan Account Value|Account Value/i.test(text);
        if (hasValidPeriod || hasAccountValue) {
          return res.json({
            success: false,
            ocrLowQuality: true,
            year: parsedYear,
            type,
            messageKey: 'import.ocrFidelityStatementNoActivity'
          });
        }
        const hasPaddleOcr = checkPaddleOcrAvailable().available;
        return res.json({
          success: false,
          ocrLowQuality: true,
          year: parsedYear,
          type,
          messageKey: hasPaddleOcr ? 'import.ocrFidelityStatementParseFailed' : 'import.ocrFidelityStatementHint'
        });
      }

      // Add sales to trades table (dedup by date + shares + proceeds)
      let newTradesAdded = 0, duplicatesSkipped = 0;
      for (const sale of parsed.sales) {
        if (db.addTradeIfNotDuplicate(sale)) {
          newTradesAdded++;
          // Also add to ledger for FIFO tracking
          ledger.addTrade(sale, rawFile);
        } else {
          duplicatesSkipped++;
        }
      }

      // Add ESPP purchases to ledger
      for (const espp of parsed.esppPurchases) {
        const esppTrade = {
          year: parsedYear,
          symbol: 'MSFT',
          shares: espp.shares,
          pricePerShare: espp.purchasePrice,
          purchaseCost: espp.costUSD,
          accumulatedContributions: espp.costUSD,
          marketValue: espp.fmv ? espp.shares * espp.fmv : espp.costUSD,
          esppGain: espp.gainUSD || 0,
          offeringPeriod: espp.offeringPeriod || '',
          saleDate: espp.date,
          transactionType: 'purchase',
          source: 'fidelity_statement',
        };
        db.addTrade(esppTrade);
        ledger.addTrade(esppTrade, rawFile);
      }

      // Build year data update
      const yearData = db.getYearData(parsedYear) || { year: parsedYear };

      // Store vests with USD cost basis (deduplicated)
      if (!yearData.fidelityVests) yearData.fidelityVests = [];
      for (const vest of parsed.vests) {
        const isDup = yearData.fidelityVests.some(v =>
          v.date === vest.date && Math.abs(v.shares - vest.shares) < 0.001
        );
        if (!isDup) yearData.fidelityVests.push(vest);
      }

      // Store statement metadata (dividends YTD, tax YTD, realized gains YTD)
      // Keep the highest YTD value (latest month uploaded)
      if (parsed.dividendsYTD > (yearData.fidelityDividendsYTD || 0)) {
        yearData.fidelityDividendsYTD = parsed.dividendsYTD;
      }
      if (parsed.taxWithheldYTD > (yearData.fidelityTaxWithheldYTD || 0)) {
        yearData.fidelityTaxWithheldYTD = parsed.taxWithheldYTD;
      }
      if (parsed.realizedGainYTD > (yearData.fidelityRealizedGainYTD || 0)) {
        yearData.fidelityRealizedGainYTD = parsed.realizedGainYTD;
      }
      yearData.fidelityLongTermGainYTD = parsed.longTermGainYTD || yearData.fidelityLongTermGainYTD || 0;
      yearData.fidelityShortTermGainYTD = parsed.shortTermGainYTD || yearData.fidelityShortTermGainYTD || 0;

      // Store total cost basis from sales for tax calculation
      const salesCostBasis = parsed.sales.reduce((s, sale) => s + (sale.costBasisUSD || 0), 0);
      yearData.fidelitySalesCostBasisUSD = (yearData.fidelitySalesCostBasisUSD || 0) + salesCostBasis;

      // Update fidelityTrades aggregate
      const yearTrades = db.getTradesByYear(parsedYear);
      const ySales = yearTrades.filter(t => t.transactionType !== 'purchase');
      const yPurchases = yearTrades.filter(t => t.transactionType === 'purchase');
      yearData.fidelityTrades = {
        count: ySales.length,
        totalProceeds: ySales.reduce((s, t) => s + (t.saleProceeds || 0), 0),
        totalFees: ySales.reduce((s, t) => s + (t.fees || 0), 0),
        totalNet: ySales.reduce((s, t) => s + (t.netProceeds || 0), 0),
        totalShares: ySales.reduce((s, t) => s + (t.shares || 0), 0),
        totalCostBasis: ySales.reduce((s, t) => s + (t.costBasisUSD || 0), 0),
        purchases: yPurchases.length,
        totalEsppGain: yPurchases.reduce((s, t) => s + (t.esppGain || 0), 0),
        totalEsppContributions: yPurchases.reduce((s, t) => s + (t.accumulatedContributions || 0), 0),
        totalEsppShares: yPurchases.reduce((s, t) => s + (t.shares || 0), 0),
        trades: yearTrades,
      };

      db.setYearData(parsedYear, yearData);
      const ledgerAlloc = ledger.getAllocations(parsedYear);

      return res.json({
        success: true, year: parsedYear, type, parsed,
        newTradesAdded, duplicatesSkipped,
        totalTrades: ySales.length,
        vests: parsed.vests.length,
        esppPurchases: parsed.esppPurchases.length,
        ledgerAllocations: ledgerAlloc,
      });
    }

    // Tradeville Portfolio (Capital Gains)
    if (type === 'tradeville_portfolio') {
      // Try PaddleOCR table data first for structured extraction
      let parsed;
      if (paddleResult && paddleResult.tables && paddleResult.tables.length > 0) {
        parsed = parseTradevilleFromTables(paddleResult.tables, parsedYear);
        log('INFO', 'Tradeville parsed via PaddleOCR tables', { countries: parsed.countries.length });
      }
      // Fall back to regex-based text parsing
      if (!parsed || (parsed.countries.length === 0 && parsed.totalGainNetRON === 0)) {
        parsed = parseTradevillePortfolio(text, parsedYear);
      }
      // Check if OCR produced usable data
      if (parsed.countries.length === 0 && parsed.totalGainNetRON === 0) {
        return res.json({
          success: false,
          ocrLowQuality: true,
          year: parsedYear,
          type,
          messageKey: 'import.ocrTradevilleHint'
        });
      }
      parsed.ocrEngine = ocrEngine;
      db.mergeYearData(parsedYear, { tradevillePortfolio: parsed });
      return res.json({ success: true, year: parsedYear, type, parsed, ocrEngine });
    }

    // Parse based on type and update year data
    const parsed = parsePdfText(text, type, parsedYear);
    db.mergeYearData(parsedYear, { [type]: parsed });

    res.json({ success: true, year: parsedYear, type, parsed, ocrEngine });
  } catch (err) {
    log('ERROR', 'Upload processing failed', { error: err.message, type: req.body?.type, year: req.body?.year });
    res.status(500).json({ error: err.message });
  }
});

// GET /api/stock-withholding - Get stock withholding summary
app.get('/api/stock-withholding', (req, res) => {
  try {
    const allAwards = db.getAllStockAwards();
    if (allAwards.length === 0) {
      return res.json({ total: 0, rows: [] });
    }
    const yearFilter = req.query.year ? parseInt(req.query.year, 10) : null;
    let total = 0;
    let totalBik = 0;
    const rows = [];
    const parseRowYear = (row) => {
      const dateStr = row.datastat || row.date || row.Date || '';
      const m = dateStr.match(/(\d{4})$/) || dateStr.match(/(\d{2})$/);
      if (!m) return null;
      let y = parseInt(m[1], 10);
      if (y < 100) y += 2000;
      return y;
    };
    for (const row of allAwards) {
      const rowYear = parseRowYear(row);
      if (yearFilter && rowYear !== yearFilter) continue;
      const whVal = parseFloat(row.stock_withholding) || 0;
      const bik = parseFloat(row.stock_award_bik) || 0;
      const esppBik = parseFloat(row.espp_gain_bik) || 0;
      const rowBik = bik + esppBik;
      if (whVal > 0 || rowBik > 0) {
        total += whVal;
        totalBik += rowBik;
        rows.push(row);
      }
    }
    res.json({ total, totalBik, rows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/stock-awards - Get all stock awards with assignment info
app.get('/api/stock-awards', (req, res) => {
  try {
    res.json({ awards: db.getAllStockAwards() });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/stock-awards/assign - Assign stock awards to a fiscal year
app.post('/api/stock-awards/assign', (req, res) => {
  try {
    const { ids, assignedYear } = req.body;
    if (!Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ error: 'ids must be a non-empty array' });
    }
    if (assignedYear !== null && (!Number.isInteger(assignedYear) || assignedYear < 2000 || assignedYear > 2100)) {
      return res.status(400).json({ error: 'assignedYear must be an integer year or null to unassign' });
    }
    let updated;
    if (assignedYear === null) {
      updated = db.unassignStockAwardYear(ids);
    } else {
      updated = db.assignStockAwardYear(ids, assignedYear);
    }
    ledger.recalculate();
    log('INFO', 'Stock award year assignment', { ids, assignedYear, updated });
    res.json({ success: true, updated });
  } catch (err) {
    log('ERROR', 'Stock award assign failed', { error: err.message });
    res.status(500).json({ error: err.message });
  }
});

// GET /api/trades - Get all Fidelity trade confirmations
app.get('/api/trades', (req, res) => {
  try {
    const yearFilter = req.query.year ? parseInt(req.query.year, 10) : null;
    const trades = yearFilter ? db.getTradesByYear(yearFilter) : db.getAllTrades();
    const totalProceeds = trades.reduce((s, t) => s + (t.saleProceeds || 0), 0);
    const totalNet = trades.reduce((s, t) => s + (t.netProceeds || 0), 0);
    const totalShares = trades.reduce((s, t) => s + (t.shares || 0), 0);
    res.json({ trades, totalProceeds, totalNet, totalShares, count: trades.length });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/ledger/allocations - Get FIFO cost basis and BIK allocations
app.get('/api/ledger/allocations', (req, res) => {
  try {
    const year = req.query.year ? parseInt(req.query.year, 10) : null;
    if (year) {
      res.json(ledger.getAllocations(year));
    } else {
      res.json(ledger.getAllAllocations());
    }
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/ledger/summary - Ledger summary for debugging
app.get('/api/ledger/summary', (req, res) => {
  try {
    res.json(ledger.getSummary());
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/ledger/migrate - Migrate existing data into ledger
app.post('/api/ledger/migrate', (req, res) => {
  try {
    const result = ledger.migrateFromExisting(DATA_DIR);
    res.json({ success: true, migrated: result });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/version - App version
app.get('/api/version', (req, res) => {
  const pkg = JSON.parse(fs.readFileSync(path.join(__dirname, 'package.json'), 'utf8'));
  res.json({ version: pkg.version, name: pkg.name });
});

// GET /api/check-update - Check GitHub for latest release
app.get('/api/check-update', async (req, res) => {
  try {
    const pkg = JSON.parse(fs.readFileSync(path.join(__dirname, 'package.json'), 'utf8'));
    const currentVersion = pkg.version;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);
    const ghRes = await fetch('https://api.github.com/repos/edmund-1/D212TaxHelper/releases/latest', {
      headers: { 'Accept': 'application/vnd.github+json', 'User-Agent': 'D212TaxHelper' },
      signal: controller.signal
    });
    clearTimeout(timeout);
    if (!ghRes.ok) {
      return res.json({ updateAvailable: false, currentVersion, error: `GitHub API ${ghRes.status}` });
    }
    const release = await ghRes.json();
    const latestVersion = (release.tag_name || '').replace(/^v/, '');
    const updateAvailable = _isNewerVersion(currentVersion, latestVersion);
    const downloadUrl = (release.assets || []).find(a => a.name.endsWith('.zip'))?.browser_download_url
      || release.html_url;
    res.json({
      updateAvailable,
      currentVersion,
      latestVersion,
      releaseUrl: release.html_url,
      downloadUrl,
      releaseName: release.name || `v${latestVersion}`,
      publishedAt: release.published_at
    });
  } catch (err) {
    log('WARN', 'Update check failed', { error: err.message });
    res.json({ updateAvailable: false, error: err.message });
  }
});

// Compare semver: returns true if latest > current
function _isNewerVersion(current, latest) {
  if (!current || !latest) return false;
  const c = current.split('.').map(Number);
  const l = latest.split('.').map(Number);
  for (let i = 0; i < 3; i++) {
    if ((l[i] || 0) > (c[i] || 0)) return true;
    if ((l[i] || 0) < (c[i] || 0)) return false;
  }
  return false;
}

// POST /api/update/download - Download latest release ZIP from GitHub
app.post('/api/update/download', async (req, res) => {
  const updateDir = path.join(__dirname, '_update');
  const zipPath = path.join(updateDir, 'update.zip');
  try {
    // Get latest release info
    const controller = new AbortController();
    const infoTimeout = setTimeout(() => controller.abort(), 10000);
    const ghRes = await fetch('https://api.github.com/repos/edmund-1/D212TaxHelper/releases/latest', {
      headers: { 'Accept': 'application/vnd.github+json', 'User-Agent': 'D212TaxHelper' },
      signal: controller.signal
    });
    clearTimeout(infoTimeout);
    if (!ghRes.ok) return res.status(502).json({ success: false, error: `GitHub API returned ${ghRes.status}` });
    const release = await ghRes.json();
    const asset = (release.assets || []).find(a => a.name.endsWith('.zip'));
    if (!asset) return res.status(404).json({ success: false, error: 'No ZIP asset found in latest release' });

    // Create _update dir
    if (fs.existsSync(updateDir)) fs.rmSync(updateDir, { recursive: true, force: true });
    fs.mkdirSync(updateDir, { recursive: true });

    // Download ZIP
    log('INFO', 'Downloading update', { url: asset.browser_download_url, size: asset.size });
    const dlController = new AbortController();
    const dlTimeout = setTimeout(() => dlController.abort(), 300000); // 5 min
    const dlRes = await fetch(asset.browser_download_url, {
      headers: { 'User-Agent': 'D212TaxHelper' },
      signal: dlController.signal
    });
    clearTimeout(dlTimeout);
    if (!dlRes.ok) return res.status(502).json({ success: false, error: `Download failed: HTTP ${dlRes.status}` });

    const fileStream = fs.createWriteStream(zipPath);
    const reader = dlRes.body.getReader();
    let downloaded = 0;
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      fileStream.write(Buffer.from(value));
      downloaded += value.length;
    }
    fileStream.end();
    await new Promise((resolve, reject) => { fileStream.on('finish', resolve); fileStream.on('error', reject); });

    const latestVersion = (release.tag_name || '').replace(/^v/, '');
    log('INFO', 'Update downloaded', { size: downloaded, version: latestVersion });
    res.json({
      success: true,
      version: latestVersion,
      size: downloaded,
      releaseNotes: release.body || ''
    });
  } catch (err) {
    log('ERROR', 'Update download failed', { error: err.message });
    if (fs.existsSync(updateDir)) fs.rmSync(updateDir, { recursive: true, force: true });
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/update/install - Extract downloaded ZIP and apply update
app.post('/api/update/install', async (req, res) => {
  const updateDir = path.join(__dirname, '_update');
  const zipPath = path.join(updateDir, 'update.zip');
  const stagingDir = path.join(updateDir, 'staging');

  if (!fs.existsSync(zipPath)) {
    return res.status(400).json({ success: false, error: 'No update downloaded. Call /api/update/download first.' });
  }

  try {
    // Extract ZIP — prefer tar (handles long paths in node_modules), fall back to PowerShell
    log('INFO', 'Extracting update ZIP...');
    if (fs.existsSync(stagingDir)) fs.rmSync(stagingDir, { recursive: true, force: true });
    fs.mkdirSync(stagingDir, { recursive: true });

    await new Promise((resolve, reject) => {
      const { execFile: ef } = require('child_process');
      // Try tar first (Windows 10+ built-in, handles >260 char paths)
      ef('tar', ['-xf', zipPath, '-C', stagingDir], { timeout: 120000, windowsHide: true }, (tarErr) => {
        if (!tarErr) return resolve();
        log('WARN', 'tar extraction failed, trying PowerShell', { error: tarErr.message });
        // Fallback to PowerShell Expand-Archive
        ef('powershell.exe', [
          '-NoProfile', '-Command',
          `Expand-Archive -Path '${zipPath}' -DestinationPath '${stagingDir}' -Force`
        ], { timeout: 120000, windowsHide: true }, (psErr) => {
          if (psErr) reject(new Error('Failed to extract ZIP: ' + psErr.message));
          else resolve();
        });
      });
    });

    // Find the app folder inside staging (may be nested: staging/app/ or staging/D212TaxHelper-Portable/app/)
    let sourceAppDir = null;
    const findAppDir = (dir) => {
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      if (entries.some(e => e.name === 'server.js' && e.isFile())) return dir;
      for (const e of entries) {
        if (e.isDirectory()) {
          const found = findAppDir(path.join(dir, e.name));
          if (found) return found;
        }
      }
      return null;
    };
    sourceAppDir = findAppDir(stagingDir);
    if (!sourceAppDir) {
      throw new Error('Could not find app files (server.js) in the extracted ZIP');
    }

    // Directories to preserve (user data)
    const PRESERVE = new Set(['data', 'uploads', 'python', 'node_modules', '_update', 'logs', '_python_temp']);

    // Copy new app files over existing ones, preserving user data dirs
    const copyRecursive = (src, dest) => {
      const entries = fs.readdirSync(src, { withFileTypes: true });
      for (const entry of entries) {
        const srcPath = path.join(src, entry.name);
        const destPath = path.join(dest, entry.name);
        // Skip preserved directories at the app root level
        if (src === sourceAppDir && PRESERVE.has(entry.name)) continue;
        if (entry.isDirectory()) {
          fs.mkdirSync(destPath, { recursive: true });
          copyRecursive(srcPath, destPath);
        } else {
          fs.copyFileSync(srcPath, destPath);
        }
      }
    };

    log('INFO', 'Applying update files...');
    copyRecursive(sourceAppDir, __dirname);

    // Copy root-level files (Start.bat, Stop.bat, README.md, etc.) if in portable layout
    const portableRoot = path.dirname(__dirname);
    const rootStagingDir = path.dirname(sourceAppDir);
    if (rootStagingDir !== stagingDir || fs.existsSync(path.join(rootStagingDir, 'Start.bat'))) {
      for (const f of ['Start.bat', 'Stop.bat', 'README.md', 'Upgrade-to-Full.bat', 'Downgrade-to-Lite.bat']) {
        const srcFile = path.join(rootStagingDir, f);
        const destFile = path.join(portableRoot, f);
        if (fs.existsSync(srcFile) && fs.existsSync(path.join(portableRoot, 'node'))) {
          try { fs.copyFileSync(srcFile, destFile); } catch { /* skip if locked */ }
        }
      }
    }

    // Clean up staging and zip (keep _update dir marker to detect fresh update)
    fs.rmSync(stagingDir, { recursive: true, force: true });
    fs.rmSync(zipPath, { force: true });

    // Read new version from the updated package.json
    const newPkg = JSON.parse(fs.readFileSync(path.join(__dirname, 'package.json'), 'utf8'));
    const updatedMarker = path.join(updateDir, 'updated_to');
    fs.writeFileSync(updatedMarker, newPkg.version, 'utf8');

    log('INFO', 'Update applied successfully', { newVersion: newPkg.version });
    res.json({ success: true, version: newPkg.version });

    // Restart the server after response is sent
    setTimeout(() => {
      const { spawn } = require('child_process');
      const child = spawn(process.argv[0], [path.join(__dirname, 'server.js')], {
        cwd: __dirname,
        detached: true,
        stdio: 'ignore',
        windowsHide: true
      });
      child.unref();
      process.exit(0);
    }, 500);

  } catch (err) {
    log('ERROR', 'Update install failed', { error: err.message });
    // Clean up on failure
    if (fs.existsSync(stagingDir)) fs.rmSync(stagingDir, { recursive: true, force: true });
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/changelog/:lang - Changelog content
app.get('/api/changelog/:lang', (req, res) => {
  const lang = req.params.lang === 'ro' ? 'ro' : 'en';
  const file = path.join(__dirname, `CHANGELOG.${lang}.md`);
  if (fs.existsSync(file)) {
    res.type('text/plain').send(fs.readFileSync(file, 'utf8'));
  } else {
    res.status(404).json({ error: 'Changelog not found' });
  }
});

// GET /api/doc/:name/:lang - Serve markdown docs (README, GUIDE)
app.get('/api/doc/:name/:lang', (req, res) => {
  const lang = req.params.lang === 'ro' ? 'ro' : 'en';
  const allowed = { readme: 'README', guide: 'GUIDE' };
  const base = allowed[req.params.name];
  if (!base) return res.status(400).json({ error: 'Unknown document' });
  // README has no lang suffix for EN, GUIDE always has suffix
  const file = base === 'README'
    ? path.join(__dirname, lang === 'ro' ? 'README.ro.md' : 'README.md')
    : path.join(__dirname, `${base}.${lang}.md`);
  if (fs.existsSync(file)) {
    res.type('text/plain').send(fs.readFileSync(file, 'utf8'));
  } else {
    res.status(404).json({ error: 'Document not found' });
  }
});

// GET /api/tax-rates - Romanian tax rates reference
app.get('/api/tax-rates', (req, res) => {
  res.json({
    // Romanian tax rates for various income types
    rates: {
      dividends: { rate: 0.08, label: 'Dividend Tax (8%)' },
      capitalGains: { rate: 0.10, label: 'Capital Gains Tax - US (10%)' },
      interestIncome: { rate: 0.10, label: 'Interest Income Tax (10%)' },
      cass: { rate: 0.10, label: 'CASS Health Contribution (10% - tiered)' },
      roDividends: { rate: 0.08, label: 'Romania Dividend Tax (8%)' },
      roCapitalGainsLong: { rate: 0.01, label: 'Romania Stock Sales >=1yr (1%)' },
      roCapitalGainsShort: { rate: 0.03, label: 'Romania Stock Sales <1yr (3%)' },
    },
    // CASS tiered thresholds 2025 (salariu minim brut 4,050 RON)
    // Investment income: max 24SM cap (D212 pct. 52.1.1-52.1.3)
    // 60SM cap applies only to independent activities (PFA)
    cassInfo: {
      minSalary2025: 4050,
      note: 'CAS (pension 25%) does NOT apply for investment income. CASS uses tiered brackets. Investment income capped at 24SM.',
      tiers: [
        { label: '<6SM (<24,300)', cass: 0 },
        { label: '6-12SM (24,300-48,600)', cass: 2430 },
        { label: '12-24SM (48,600-97,200)', cass: 4860 },
        { label: '≥24SM (≥97,200)', cass: 9720 },
      ]
    },
    // BNR exchange rates (annual averages - Serii anuale, valori medii)
    exchangeRates: {
      2019: { usdRon: 4.2379, source: 'BNR' },
      2020: { usdRon: 4.2440, source: 'BNR' },
      2021: { usdRon: 4.1604, source: 'BNR' },
      2022: { usdRon: 4.6885, source: 'BNR' },
      2023: { usdRon: 4.5743, source: 'BNR' },
      2024: { usdRon: 4.5984, source: 'BNR' },
      2025: { usdRon: 4.4705, source: 'BNR' },
    },
    notes: {
      ro: 'Starting 2025, stocks transferred to Romania broker. Romania broker withholds capital gains tax (1%/3%) but NOT CASS.',
      cas: 'CAS (pension 25%) does NOT apply for investment income (stocks, dividends, interest).',
      cass: 'CASS uses tiered brackets based on min salary 4,050 RON/month for 2025. Romania broker does NOT withhold CASS.',
      anaf: 'Source: https://www.anaf.ro/',
      bnr: 'Exchange rates: https://www.bnr.ro/1975-cursul-de-schimb-serii-statistice'
    }
  });
});

// GET /api/exchange-rates - Exchange rates
app.get('/api/exchange-rates', (req, res) => {
  res.json({
    2019: { usdRon: 4.2379, source: 'BNR' },
    2020: { usdRon: 4.2440, source: 'BNR' },
    2021: { usdRon: 4.1604, source: 'BNR' },
    2022: { usdRon: 4.6885, source: 'BNR' },
    2023: { usdRon: 4.5743, source: 'BNR' },
    2024: { usdRon: 4.5984, source: 'BNR' },
    2025: { usdRon: 4.4705, source: 'BNR' }
  });
});

// Helper: parse PDF text based on type
function parsePdfText(text, type, year) {
  switch (type) {
    case 'declaratie':
      // ANAF rendered/image PDFs have "FORMULAR VALIDAT" signature
      if (/FORMULAR VALIDAT/i.test(text)) {
        return parseAnafD212FlatText(text, year);
      }
      return parseDeclaratie(text, year);
    case 'investment':
      return parseInvestment(text, year);
    case 'adeverinta':
      return parseAdeverinta(text, year);
    default:
      return { rawText: text };
  }
}

function parseNumber(str) {
  if (!str) return 0;
  return parseFloat(str.toString().replace(/,/g, ''));
}

// Extract structured data from ANAF D-212 XFA PDF (embedded XML in FlateDecode streams)
function extractAnafD212Xml(pdfBuffer) {
  const zlib = require('zlib');
  const raw = pdfBuffer.toString('latin1');
  let xml = '';
  let idx = 0;
  // Scan all FlateDecode streams and concatenate D212-related XML
  while (true) {
    const si = raw.indexOf('stream\r\n', idx);
    if (si < 0) break;
    const ei = raw.indexOf('endstream', si);
    if (ei < 0) break;
    const data = pdfBuffer.slice(si + 8, ei);
    try {
      const dec = zlib.inflateSync(data).toString('utf8');
      if (dec.includes('<d212 ') || dec.includes('mfp:anaf:dgti:d212') || dec.includes('xfa:data') || dec.includes('anRealizat')) {
        xml += dec + '\n';
      }
    } catch { /* not a valid zlib stream */ }
    idx = ei + 9;
  }
  if (!xml || !xml.includes('<d212 ')) return null;

  // Parse ANAF D-212 XML categories:
  // str_categ_venit codes: 2012=capital gains (transferul titlurilor), 2018=dividends (dubla impunere)
  // See ANAF schema: mfp:anaf:dgti:d212:declaratie:v11
  const result = {
    year: 0,
    dividends: { grossUSD: 0, grossRON: 0, foreignTaxUSD: 0, foreignTaxRON: 0, taxDueRON: 0, creditFiscalRON: 0, difImpozitRON: 0 },
    capitalGains: { saleUSD: 0, saleRON: 0, costUSD: 0, costRON: 0, salaryDeductionRON: 0, taxableRON: 0, taxDueRON: 0, difImpozitRON: 0 },
    totalTax: 0,
    cassContribution: 0,
    exchangeRate: 0,
    anafXml: true
  };

  // Extract income year from anRealizat (XFA data) — this is the tax year
  // Fallback to an_r (filing deadline year) minus 1
  const anRealizat = xml.match(/<anRealizat[^>]*>\s*(\d{4})/);
  const anR = xml.match(/an_r="(\d{4})"/);
  if (anRealizat) {
    result.year = parseInt(anRealizat[1], 10);
  } else if (anR) {
    result.year = parseInt(anR[1], 10) - 1; // filing year is income year + 1
  }

  // Parse cap14 entries (summary lines with category codes)
  const cap14Pattern = /<cap14\s+([^/]*?)\/>/g;
  let match;
  while ((match = cap14Pattern.exec(xml)) !== null) {
    const attrs = match[1];
    const categ = attrs.match(/str_categ_venit="(\d+)"/);
    if (!categ) continue;
    const code = categ[1];
    const getAttr = (name) => {
      const m = attrs.match(new RegExp(name + '="([^"]*)"'));
      return m ? parseFloat(m[1]) || 0 : 0;
    };

    if (code === '2012') {
      // Capital gains (Câștiguri din transferul titlurilor de valoare)
      result.capitalGains.taxableRON = getAttr('str_venit_net_anual');
      result.capitalGains.taxDueRON = getAttr('str_impozit_datorat_Ro');
      result.capitalGains.difImpozitRON = getAttr('str_dif_impozit_datorat');
    } else if (code === '2018') {
      // Dividends (Venituri din dividende — dubla impunere)
      // Per ANAF D-212 instructions:
      //   str_impozit_datorat_Ro = tax calculated in Romania (before credit)
      //   str_impozit_platit = foreign tax paid (e.g., US withholding)
      //   str_credit_fiscal = min(impRo, impSt) = fiscal credit applied
      //   str_dif_impozit_datorat = impRo - creditFiscal = actual amount owed (0 if credit covers it)
      result.dividends.grossRON = getAttr('str_venit_brut') || getAttr('str_venit_net_anual');
      result.dividends.taxDueRON = getAttr('str_impozit_datorat_Ro');
      result.dividends.foreignTaxRON = getAttr('str_impozit_platit');
      result.dividends.creditFiscalRON = getAttr('str_credit_fiscal');
      result.dividends.difImpozitRON = getAttr('str_dif_impozit_datorat');
    }
  }

  // Parse obligatii fiscale totals from oblig_realizat
  const obligMatch = xml.match(/<oblig_realizat\s+([^/]*?)\/>/);
  if (obligMatch) {
    const attrs = obligMatch[1];
    const totalImp = attrs.match(/oblimpoz_real_total="(\d+)"/);
    if (totalImp) result.totalTax = parseInt(totalImp[1], 10);
  }

  // Parse CASS from the XFA data section (only within the cass18 element)
  const cassSection = xml.match(/<cass18[\s\S]*?<\/cass18/);
  if (cassSection) {
    const cassDtr = cassSection[0].match(/<dtr1[^/]>(\d+)/);
    if (cassDtr) result.cassContribution = parseInt(cassDtr[1], 10);
  }

  return result;
}

// Parse ANAF D-212 "FORMULAR VALIDAT" flat text (rendered/image PDFs with text layers)
// Numbers use ANAF format with spaces before dots: "18 .424" = 18424, "1 .800" = 1800
function parseAnafD212FlatText(text, year) {
  const result = {
    year,
    dividends: { grossUSD: 0, grossRON: 0, foreignTaxUSD: 0, foreignTaxRON: 0, taxDueRON: 0, creditFiscalRON: 0, difImpozitRON: 0 },
    capitalGains: { saleUSD: 0, saleRON: 0, costUSD: 0, costRON: 0, salaryDeductionRON: 0, taxableRON: 0, taxDueRON: 0, difImpozitRON: 0 },
    totalTax: 0,
    cassContribution: 0,
    exchangeRate: 0,
    anafFlatText: true
  };

  // Normalize ANAF number: "18 .424" → 18424, "346" → 346
  const parseAnafNum = (s) => parseInt(s.replace(/\s+/g, '').replace(/\./g, ''), 10) || 0;

  // Split into lines preserving blanks for section boundary detection
  const rawLines = text.split('\n').map(l => l.trim());
  // Non-empty lines for data extraction
  const lines = rawLines.filter(l => l.length > 0);

  // Extract income year: first 4-digit number after FORMULAR VALIDAT
  for (const line of lines) {
    if (/^\d{4}$/.test(line) && parseInt(line) >= 2019 && parseInt(line) <= 2030) {
      result.year = parseInt(line, 10);
      break;
    }
  }

  // Find country sections (XX--Country Name)
  const countrySections = [];
  for (let i = 0; i < lines.length; i++) {
    if (/^[A-Z]{2}--/.test(lines[i])) {
      countrySections.push(i);
    }
  }

  // Extract numbers between country markers (or until end)
  const extractNums = (startIdx, endIdx) => {
    const nums = [];
    for (let i = startIdx; i < endIdx; i++) {
      // Match ANAF numbers: "18 .424", "1 .800", "346", "0"
      if (/^\d[\d\s]*(?:\.\d+)?$/.test(lines[i])) {
        nums.push(parseAnafNum(lines[i]));
      }
    }
    return nums;
  };

  // Find country marker positions in rawLines (preserves blank line boundaries)
  const rawCountryPositions = [];
  for (let i = 0; i < rawLines.length; i++) {
    if (/^[A-Z]{2}--/.test(rawLines[i])) rawCountryPositions.push(i);
  }

  // Helper: extract numbers from rawLines section (until blank line AFTER numbers start)
  const extractRawNums = (startRawIdx, endRawIdx) => {
    const nums = [];
    let foundData = false;
    for (let i = startRawIdx; i < endRawIdx; i++) {
      if (/^\d[\d\s]*(?:\.\d+)?$/.test(rawLines[i])) {
        nums.push(parseAnafNum(rawLines[i]));
        foundData = true;
      } else if (rawLines[i] === '' && foundData) {
        break; // blank line after data = end of section
      }
    }
    return nums;
  };

  if (countrySections.length >= 2) {
    // Section 1 (first country): Capital gains — 4 numbers
    // [venitNet, venitRecalculat, impRo, difImp]
    const cgNums = extractNums(countrySections[0] + 1, countrySections[1]);
    if (cgNums.length >= 4) {
      result.capitalGains.taxableRON = cgNums[0];
      result.capitalGains.taxDueRON = cgNums[2];
      result.capitalGains.difImpozitRON = cgNums[3];
    }

    // Section 2 (second country): Dividends
    // Old format (2020-2022): 9 nums, New format (2023+): 7 nums
    let divNums = [];
    if (rawCountryPositions.length >= 2) {
      const rawDivStart = rawCountryPositions[1] + 1;
      const rawDivEnd = rawCountryPositions.length > 2 ? rawCountryPositions[2] : rawLines.length;
      divNums = extractRawNums(rawDivStart, rawDivEnd);
    }
    if (divNums.length < 7) {
      // Fallback: extract from filtered lines
      const endIdx2 = countrySections.length > 2 ? countrySections[2] : lines.length;
      divNums = extractNums(countrySections[1] + 1, Math.min(countrySections[1] + 1 + 9, endIdx2));
    }
    if (divNums.length >= 7) {
      // Per ANAF D-212: [-4]=impRo, [-3]=impSt, [-2]=creditFiscal, [-1]=difImpozit
      result.dividends.grossRON = divNums[0];
      result.dividends.taxDueRON = divNums[divNums.length - 4];    // impRo (before credit)
      result.dividends.foreignTaxRON = divNums[divNums.length - 3]; // impSt (foreign tax paid)
      result.dividends.creditFiscalRON = divNums[divNums.length - 2]; // credit fiscal
      result.dividends.difImpozitRON = divNums[divNums.length - 1];  // actual amount owed after credit
    }

    // Summary section: everything after the last country section's dividends data
    // Find where dividends end (all numbers after 2nd country marker)
    let summaryStart = countrySections[1] + 1;
    let numCount = 0;
    const divNumCount = divNums.length; // actual count (7 or 9)
    for (let i = summaryStart; i < lines.length; i++) {
      if (/^\d[\d\s]*(?:\.\d+)?$/.test(lines[i])) {
        numCount++;
        if (numCount === divNumCount) { summaryStart = i + 1; break; }
      }
    }
    const summaryNums = extractNums(summaryStart, lines.length);
    // Summary layout (2023): [0,0,0,0, 18770, 0, 0, 18770, 18000, 1800, 1842, 1842, 0, 0, 0, 1800, 1800, 1800]
    // Summary layout (2024): [1690, 1690, 1690, 1690]
    // Total tax = sum of difImpozit for all sections (actual amounts owed after credits)
    result.totalTax = result.capitalGains.difImpozitRON + result.dividends.difImpozitRON;

    // Find CASS: look for a value that repeats 2-3 times in the summary and != totalTax
    const freq = {};
    for (const n of summaryNums) {
      if (n > 0) freq[n] = (freq[n] || 0) + 1;
    }
    for (const [val, count] of Object.entries(freq)) {
      const v = parseInt(val);
      if (count >= 2 && v !== result.totalTax && v !== result.capitalGains.taxableRON) {
        result.cassContribution = v;
        break;
      }
    }
  } else if (countrySections.length === 1) {
    // Single section — find numbers until blank line using rawLines
    let singleNums = [];
    if (rawCountryPositions.length >= 1) {
      singleNums = extractRawNums(rawCountryPositions[0] + 1, rawLines.length);
    }
    if (singleNums.length < 7) {
      singleNums = extractNums(countrySections[0] + 1, Math.min(countrySections[0] + 1 + 9, lines.length));
    }
    if (singleNums.length >= 7) {
      // Dividends only: [-4]=impRo, [-3]=impSt, [-2]=creditFiscal, [-1]=difImpozit
      result.dividends.grossRON = singleNums[0];
      result.dividends.taxDueRON = singleNums[singleNums.length - 4];    // impRo (before credit)
      result.dividends.foreignTaxRON = singleNums[singleNums.length - 3]; // impSt (foreign tax paid)
      result.dividends.creditFiscalRON = singleNums[singleNums.length - 2]; // credit fiscal
      result.dividends.difImpozitRON = singleNums[singleNums.length - 1];  // actual amount owed after credit
      result.totalTax = singleNums[singleNums.length - 1]; // difImpozit
    } else if (singleNums.length >= 4) {
      // Capital gains only
      result.capitalGains.taxableRON = singleNums[0];
      result.capitalGains.taxDueRON = singleNums[2];
      result.capitalGains.difImpozitRON = singleNums[3];
      result.totalTax = singleNums[3]; // difImpozit
    }
  }

  return result;
}

function parseDeclaratie(text, year) {
  const result = {
    year,
    dividends: { grossUSD: 0, grossRON: 0, foreignTaxUSD: 0, foreignTaxRON: 0, taxDueRON: 0 },
    capitalGains: { saleUSD: 0, saleRON: 0, costUSD: 0, costRON: 0, salaryDeductionRON: 0, taxableRON: 0, taxDueRON: 0 },
    totalTax: 0,
    cassContribution: 0,
    exchangeRate: 0
  };
  const rateMatch = text.match(/Curs de schimb.*?(\d+[.,]\d+)/);
  if (rateMatch) result.exchangeRate = parseNumber(rateMatch[1]);
  const saleMatch = text.match(/Valoare la vanzare\s+([\d.,]+)\s+([\d.,]+)/);
  if (saleMatch) { result.capitalGains.saleUSD = parseNumber(saleMatch[1]); result.capitalGains.saleRON = parseNumber(saleMatch[2]); }
  const costMatch = text.match(/Valoare la achizitie\s+([\d.,]+)\s+([\d.,]+)/);
  if (costMatch) { result.capitalGains.costUSD = parseNumber(costMatch[1]); result.capitalGains.costRON = parseNumber(costMatch[2]); }
  const salaryDeductMatch = text.match(/Venit impozitat deja ca salariu.*?(\d[\d.,]*)/);
  if (salaryDeductMatch) result.capitalGains.salaryDeductionRON = parseNumber(salaryDeductMatch[1]);
  const taxableMatch = text.match(/Venit impozabil\s+([\d.,]+)/);
  if (taxableMatch) result.capitalGains.taxableRON = parseNumber(taxableMatch[1]);
  const cgTaxMatch = text.match(/Impozit pe venit datorat in Romania \(10%\)\s+([\d.,]+)/);
  if (cgTaxMatch) result.capitalGains.taxDueRON = parseNumber(cgTaxMatch[1]);
  const divBrutMatch = text.match(/Dividende.*\nVenit brut\s+([\d.,]+)\s+([\d.,]+)/);
  if (divBrutMatch) { result.dividends.grossUSD = parseNumber(divBrutMatch[1]); result.dividends.grossRON = parseNumber(divBrutMatch[2]); }
  const divForeignTax = text.match(/Dividende[\s\S]*?Impozit platit in strainatate\s+([\d.,]+)\s+([\d.,]+)/);
  if (divForeignTax) { result.dividends.foreignTaxUSD = parseNumber(divForeignTax[1]); result.dividends.foreignTaxRON = parseNumber(divForeignTax[2]); }
  const divTaxDue = text.match(/Impozit datorat in Romania \(8%\)\s+([\d.,]+)/);
  if (divTaxDue) result.dividends.taxDueRON = parseNumber(divTaxDue[1]);
  const cassMatch = text.match(/CASS datorata.*?(\d[\d.,]*)\s*$/m);
  if (cassMatch) result.cassContribution = parseNumber(cassMatch[1]);
  const totalMatch = text.match(/Impozit pe venit datorat.*?(\d[\d.,]+)\s*$/m);
  if (totalMatch) result.totalTax = parseNumber(totalMatch[1]);
  return result;
}

function parseInvestment(text, year) {
  const result = {
    year,
    accountValue: 0,
    beginningValue: 0,
    dividends: { total: 0 },
    taxesWithheld: 0,
    totalDividends: 0,
    netGains: 0
  };
  const acctMatch = text.match(/Ending Account Value.*?\$([\d.,]+)/);
  if (acctMatch) result.accountValue = parseNumber(acctMatch[1]);
  const beginMatch = text.match(/Beginning Account Value.*?\$([\d.,]+)/);
  if (beginMatch) result.beginningValue = parseNumber(beginMatch[1]);
  const divTotalMatch = text.match(/Dividends\s+([\d.,]+)/);
  if (divTotalMatch) { result.dividends.total = parseNumber(divTotalMatch[1]); result.totalDividends = result.dividends.total; }
  const taxWithheld = text.match(/Taxes Withheld\s+-?([\d.,]+)/);
  if (taxWithheld) result.taxesWithheld = parseNumber(taxWithheld[1]);
  const totalHoldingsMatch = text.match(/Total Holdings\s+\$([\d.,]+)\s+\$([\d.,]+)\s+\$([-\d.,]+)\s+\$([\d.,]+)/);
  if (totalHoldingsMatch) {
    result.netGains = parseNumber(totalHoldingsMatch[3]);
    result.totalDividends = parseNumber(totalHoldingsMatch[4]);
  }
  return result;
}

function parseAdeverinta(text, year) {
  const result = {
    year,
    interestIncome: 0,
    interestTax: 0,
    gamblingIncome: 0,
    gamblingTax: 0,
    salaryIncome: 0,
    salaryTax: 0,
    sections: []
  };
  const lines = text.split('\n');
  for (let j = 0; j < lines.length; j++) {
    if (/dobanzi/.test(lines[j])) {
      for (let k = Math.max(0, j - 4); k <= j; k++) {
        const m = lines[k].match(/Realizat\s+(\d+)\s+(\d+)/);
        if (m) { result.interestIncome = parseNumber(m[1]); result.interestTax = parseNumber(m[2]); }
      }
    }
    if (/jocuri|noroc/i.test(lines[j])) {
      for (let k = Math.max(0, j - 5); k <= j; k++) {
        const m = lines[k].match(/Realizat\s+(\d+)\s+(\d+)/);
        if (m) { result.gamblingIncome = parseNumber(m[1]); result.gamblingTax = parseNumber(m[2]); }
      }
    }
  }
  return result;
}

// Parse Morgan Stanley Stock Plan Statement (yearly summary)
function parseMSStatement(text, year) {
  const result = {
    year,
    source: 'ms_statement',
    period: '',
    sales: [],
    releases: [],
    dividends: 0,
    taxWithheld: 0,
    closingValue: 0,
    closingShares: 0
  };

  // Period
  const periodMatch = text.match(/Summary Period:\s*(.+)/);
  if (periodMatch) result.period = periodMatch[1].trim();

  // Parse Activity section for releases, sales, dividends, tax withholding
  const activitySection = text.split(/\bActivity\b/)[1]?.split(/\bWithdrawal on\b/)[0] || '';
  const lines = activitySection.split('\n').map(l => l.trim()).filter(l => l);

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Release: $marketValue $price+shares MSFTRelease DD-Mon-YYYY
    const releaseMatch = line.match(/\$([\d.,]+)\$(\d+\.\d{2})(\d+\.\d+)MSFTRelease(\d{2}-\w{3}-\d{4})/);
    if (releaseMatch) {
      result.releases.push({
        date: releaseMatch[4],
        shares: parseFloat(releaseMatch[3]),
        pricePerShare: parseNumber(releaseMatch[2]),
        value: parseNumber(releaseMatch[1])
      });
      continue;
    }

    // Dividend (Cash): $amount MSFTDividend (Cash) DD-Mon-YYYY
    const divMatch = line.match(/\$([\d.,]+)MSFTDividend \(Cash\)(\d{2}-\w{3}-\d{4})/);
    if (divMatch) {
      result.dividends += parseNumber(divMatch[1]);
      continue;
    }

    // IRS Nonresident Alien Withholding: $-amount MSFTIRS Nonresident Alien
    const taxMatch = line.match(/\$-?([\d.,]+)MSFTIRS Nonresident Alien/);
    if (taxMatch) {
      result.taxWithheld += parseNumber(taxMatch[1]);
      continue;
    }

    // Sale in Activity: $-amount $price -shares MSFTSale DD-Mon-YYYY
    const saleMatch = line.match(/\$-?([\d.,]+)\$([\d.,]+)-?([\d.]+)MSFTSale(\d{2}-\w{3}-\d{4})/);
    if (saleMatch) {
      // This is the activity-level sale entry; detailed breakdown parsed below
      continue;
    }

    // Closing Value: $value $costBasis $price+shares $cash Closing Value DD-Mon-YYYY
    const closeMatch = line.match(/\$([\d.,]+)\$([\d.,]+)\$(\d+\.\d{2})(\d+\.\d+)\$[\d.,]+Closing Value/);
    if (closeMatch) {
      result.closingValue = parseNumber(closeMatch[1]);
      result.closingShares = parseFloat(closeMatch[4]);
    }
  }

  // Parse Withdrawal sections for detailed sale breakdowns
  const withdrawalSections = text.split(/Withdrawal on\s+/);
  for (let w = 1; w < withdrawalSections.length; w++) {
    const section = withdrawalSections[w];

    // Settlement Date: DD-Mon-YYYY
    const dateMatch = section.match(/(\d{2}-\w{3}-\d{4})Settlement Date/);
    const settlementDate = dateMatch ? dateMatch[1] : '';

    // Market Price Per Unit: $price USD
    const priceMatch = section.match(/\$([\d.,]+)\s*(?:\d*\s*)?USDMarket Price Per Unit/);
    const pricePerShare = priceMatch ? parseNumber(priceMatch[1]) : 0;

    // Shares Sold
    const sharesMatch = section.match(/([\d.]+)Shares Sold/);
    const shares = sharesMatch ? parseFloat(sharesMatch[1]) : 0;

    // Gross Proceeds
    const grossMatch = section.match(/\$([\d.,]+)\s*USDGross Proceeds/);
    const grossProceeds = grossMatch ? parseNumber(grossMatch[1]) : 0;

    // Fees: EFT Fee + commission + Supplemental Transaction Fee
    let totalFees = 0;
    const feeMatches = section.matchAll(/\$-?([\d.,]+)\s*USD(?:EFT Fee|commission|Supplemental Transaction Fee)/g);
    for (const fm of feeMatches) {
      totalFees += parseNumber(fm[1]);
    }

    // Net Proceeds
    const netMatch = section.match(/Net Proceeds:\s*\$([\d.,]+)\s*USD/);
    const netProceeds = netMatch ? parseNumber(netMatch[1]) : 0;

    if (shares > 0 && settlementDate) {
      // Convert DD-Mon-YYYY to a format consistent with other trades
      const monthNames = ['JAN','FEB','MAR','APR','MAY','JUN','JUL','AUG','SEP','OCT','NOV','DEC'];
      let saleDateFormatted = settlementDate;
      const dateParts = settlementDate.match(/(\d{2})-(\w{3})-(\d{4})/);
      if (dateParts) {
        const mon = dateParts[2].toUpperCase().substring(0, 3);
        saleDateFormatted = `${mon}/${dateParts[1]}/${dateParts[3]}`;
      }

      result.sales.push({
        year,
        symbol: 'MSFT',
        company: 'MICROSOFT CORP',
        shares,
        pricePerShare,
        saleProceeds: grossProceeds,
        fees: totalFees,
        netProceeds,
        saleDate: saleDateFormatted,
        gainType: 'short-term',
        source: 'ms_statement'
      });
    }
  }

  return result;
}

// Parse XTB Dividends & Interest Report (RAPORT DIVIDENDE SI DOBANZI)
function parseXtbDividends(text, year) {
  const result = {
    year,
    source: 'XTB Romania',
    dividends: { grossRON: 0, taxWithheldRON: 0, netRON: 0, category: '' },
    interest: { grossRON: 0, taxWithheldRON: 0, netRON: 0, payer: '' }
  };

  // Dividends: look for the row after the dividend header
  // Pattern: number grossRON taxRON netRON category
  const divMatch = text.match(/(\d+)\s+([\d.]+)\s+([\d.]+)\s+([\d.]+)\s+(Instrumente[^\n]*)/);
  if (divMatch) {
    result.dividends.grossRON = parseFloat(divMatch[2]) || 0;
    result.dividends.taxWithheldRON = parseFloat(divMatch[3]) || 0;
    result.dividends.netRON = parseFloat(divMatch[4]) || 0;
    result.dividends.category = divMatch[5].trim();
  }

  // Interest: look for interest section
  // Pattern after "dobânzi": number grossRON taxRON netRON payer
  const interestSection = text.split(/dob[aâ]nzi/i).pop() || '';
  const intMatch = interestSection.match(/(\d+)\s+([\d.]+)\s+([\d.]+)\s+([\d.]+)\s+([^\n]+)/);
  if (intMatch) {
    result.interest.grossRON = parseFloat(intMatch[2]) || 0;
    result.interest.taxWithheldRON = parseFloat(intMatch[3]) || 0;
    result.interest.netRON = parseFloat(intMatch[4]) || 0;
    result.interest.payer = intMatch[5].trim();
  }

  return result;
}

// Parse XTB Portfolio Sheet (FISA DE PORTOFOLIU)
// Parse IRS Form 1042-S (Foreign Person's U.S. Source Income Subject to Withholding)
function parseForm1042S(text, year) {
  const result = {
    year,
    source: 'IRS Form 1042-S',
    uniqueFormId: '',
    incomeCode: '',
    incomeType: '',
    grossIncomeUSD: 0,
    taxRate: 0,
    federalTaxWithheldUSD: 0,
    totalWithholdingCreditUSD: 0,
    withholdingAgent: '',
    recipientName: '',
    recipientCountry: '',
    accountNumber: ''
  };

  // Unique form identifier (spaced digits on a single line after UNIQUE FORM IDENTIFIER)
  const uidMatch = text.match(/UNIQUE FORM IDENTIFIER[\s\n]+(\d(?: \d)+)/i);
  if (uidMatch) result.uniqueFormId = uidMatch[1].replace(/\s/g, '');

  // Income code (1 or 2 digit code after "1 Income\ncode")
  const icMatch = text.match(/1 Income\s*\n?code\s*\n?(\d{2})/i);
  if (icMatch) result.incomeCode = icMatch[1];
  // Map common income codes
  const incomeCodes = { '01': 'Interest', '06': 'Dividends', '15': 'Pensions', '27': 'Capital Gains', '34': 'Substitute dividends' };
  result.incomeType = incomeCodes[result.incomeCode] || 'Other (' + result.incomeCode + ')';

  // Gross income (the first dollar amount after "2 Gross income")
  const giMatch = text.match(/2 Gross income\s*\n?([\d,]+\.\d{2})/i);
  if (giMatch) result.grossIncomeUSD = parseNumber(giMatch[1]);

  // Tax rate: prefer 3b (withholding rate applied to income)
  const trMatch = text.match(/3b Tax rate\s+(\d+\.\d+)/i);
  if (trMatch) result.taxRate = parseFloat(trMatch[1]);

  // Federal tax withheld (field 7a)
  // The amounts appear as a block of numbers after the form fields
  // Pattern: after "COPY B" or before page break, find the numeric block
  const numBlock = text.match(/1 9 7 4 1 2[\s\d]+\n([\d.]+)\n([\d.]+)\n([\d.]+)\n([\d.]+)\n([\d.]+)\n([\d.]+)/);
  if (numBlock) {
    // Fields: 5=withholding allowance, 6=net income, 7a=fed tax withheld, 8=tax by other, 9=overwithholding, 10=total credit
    result.federalTaxWithheldUSD = parseFloat(numBlock[3]) || 0;
    result.totalWithholdingCreditUSD = parseFloat(numBlock[6]) || 0;
  }
  // Fallback: try to find "7a Federal tax withheld" followed by amount
  if (!result.federalTaxWithheldUSD) {
    const ftMatch = text.match(/7a Federal tax withheld[\s\S]*?(\d+\.\d{2})/i);
    if (ftMatch) result.federalTaxWithheldUSD = parseFloat(ftMatch[1]) || 0;
  }

  // Withholding agent
  const waMatch = text.match(/12d Withholding agent.+name\s*\n(.+)/i);
  if (waMatch) result.withholdingAgent = waMatch[1].trim();

  // Recipient
  const rnMatch = text.match(/13a Recipient.+name\s*\n(.+)/i);
  if (rnMatch) result.recipientName = rnMatch[1].trim();

  const rcMatch = text.match(/13b Recipient.+country code\s*\n?(\w+)/i);
  if (rcMatch) result.recipientCountry = rcMatch[1].trim();

  const acMatch = text.match(/13k Recipient.+account number\s*\n?([\w-]+)/i);
  if (acMatch) result.accountNumber = acMatch[1].trim();

  return result;
}

function parseXtbPortfolio(text, year) {
  const result = {
    year,
    source: 'XTB Romania',
    longTerm: { gainRON: 0, lossRON: 0, taxWithheldRON: 0 },
    shortTerm: { gainRON: 0, lossRON: 0, taxWithheldRON: 0 },
    country: '',
    currency: 'RON',
    totalGainRON: 0,
    totalTaxWithheldRON: 0
  };

  // Pattern: country currency gain loss tax gain loss tax
  // "Statele Unite RON 5457.00 0.00 55.00 2296.00 0.00 69.00"
  const rowMatch = text.match(/(Statele Unite|Romania|[A-Z][a-z]+(?:\s[A-Z][a-z]+)*)\s+RON\s+([\d.]+)\s+([\d.]+)\s+([\d.]+)\s+([\d.]+)\s+([\d.]+)\s+([\d.]+)/);
  if (rowMatch) {
    result.country = rowMatch[1];
    result.longTerm.gainRON = parseFloat(rowMatch[2]) || 0;
    result.longTerm.lossRON = parseFloat(rowMatch[3]) || 0;
    result.longTerm.taxWithheldRON = parseFloat(rowMatch[4]) || 0;
    result.shortTerm.gainRON = parseFloat(rowMatch[5]) || 0;
    result.shortTerm.lossRON = parseFloat(rowMatch[6]) || 0;
    result.shortTerm.taxWithheldRON = parseFloat(rowMatch[7]) || 0;
  }

  result.totalGainRON = result.longTerm.gainRON + result.shortTerm.gainRON - result.longTerm.lossRON - result.shortTerm.lossRON;
  result.totalTaxWithheldRON = result.longTerm.taxWithheldRON + result.shortTerm.taxWithheldRON;

  return result;
}

// Parse Tradeville Fișă de Portofoliu (capital gains)
function parseTradevillePortfolio(text, year) {
  const result = {
    year,
    source: 'Tradeville',
    longTerm: { gainRON: 0, lossRON: 0, taxWithheldRON: 0 },
    shortTerm: { gainRON: 0, lossRON: 0, taxWithheldRON: 0 },
    countries: [],
    totalGainImpozabilRON: 0,
    totalGainNetRON: 0,
    totalTaxWithheldRON: 0
  };

  // Normalize OCR artifacts
  const cleaned = text.replace(/[|]/g, ' ').replace(/\s+/g, ' ');

  // Parse rows: Nr.crt country currency >=365gain >=365loss >=365tax <365gain <365loss <365tax totalImpozabil totalNet
  // Pattern: number country(2-3 letters) currency(RON/USD/EUR) numbers...
  const rowPattern = /(\d+)\s+(NL|RO|US|DE|FR|GB|IE|LU|CH|AT|BE|IT|ES|[A-Z]{2})\s+(RON|USD|EUR)\s+([\d.,]+)\s+([\d.,]+)\s+([\d.,]+)\s+([\d.,]+)\s+([\d.,]+)\s+([\d.,]+)\s+([\d.,]+)\s+([\d.,]+)/g;
  let match;
  while ((match = rowPattern.exec(cleaned)) !== null) {
    const country = match[2];
    const currency = match[3];
    const longGain = parseNumber(match[4]);
    const longLoss = parseNumber(match[5]);
    const longTax = parseNumber(match[6]);
    const shortGain = parseNumber(match[7]);
    const shortLoss = parseNumber(match[8]);
    const shortTax = parseNumber(match[9]);
    const totalImpozabil = parseNumber(match[10]);
    const totalNet = parseNumber(match[11]);

    result.countries.push({ country, currency, longGain, longLoss, longTax, shortGain, shortLoss, shortTax, totalImpozabil, totalNet });

    // Aggregate all countries into RO broker totals (NL/RO/US all via Romanian broker = final tax)
    result.longTerm.gainRON += longGain;
    result.longTerm.lossRON += longLoss;
    result.longTerm.taxWithheldRON += longTax;
    result.shortTerm.gainRON += shortGain;
    result.shortTerm.lossRON += shortLoss;
    result.shortTerm.taxWithheldRON += shortTax;
    result.totalGainImpozabilRON += totalImpozabil;
    result.totalGainNetRON += totalNet;
  }

  // Fallback: try to match TOTAL line
  const totalMatch = cleaned.match(/TOTAL\s+(?:ANUL\s+\d+\s+)?.*?([\d.,]+)\s*$/);
  if (totalMatch && result.totalGainNetRON === 0) {
    result.totalGainNetRON = parseNumber(totalMatch[1]);
  }

  result.totalTaxWithheldRON = result.longTerm.taxWithheldRON + result.shortTerm.taxWithheldRON;

  return result;
}

// Parse Tradeville from PaddleOCR structured table data
function parseTradevilleFromTables(tables, year) {
  const result = {
    year,
    source: 'Tradeville',
    ocrEngine: 'paddleocr',
    longTerm: { gainRON: 0, lossRON: 0, taxWithheldRON: 0 },
    shortTerm: { gainRON: 0, lossRON: 0, taxWithheldRON: 0 },
    countries: [],
    totalGainImpozabilRON: 0,
    totalGainNetRON: 0,
    totalTaxWithheldRON: 0
  };

  for (const table of tables) {
    const rows = table.cells || [];
    if (rows.length < 2) continue;

    // Find header row to identify columns
    const header = rows[0].map(h => (h || '').toLowerCase().replace(/\s+/g, ' ').trim());

    // Look for Tradeville's expected columns:
    // Nr.crt | Tara | Moneda | >=365 castig | >=365 pierdere | >=365 impozit | <365 castig | <365 pierdere | <365 impozit | Total impozabil | Total net
    const countryIdx = header.findIndex(h => /tara|country|țară/i.test(h));
    const currencyIdx = header.findIndex(h => /moneda|currency|moned/i.test(h));

    // Find gain/loss columns by pattern (>=365 and <365 sections)
    let longGainIdx = -1, longLossIdx = -1, longTaxIdx = -1;
    let shortGainIdx = -1, shortLossIdx = -1, shortTaxIdx = -1;
    let totalImpozabilIdx = -1, totalNetIdx = -1;

    for (let i = 0; i < header.length; i++) {
      const h = header[i];
      if (/>=\s*365.*castig|>=\s*365.*gain/i.test(h)) longGainIdx = i;
      else if (/>=\s*365.*pierdere|>=\s*365.*loss/i.test(h)) longLossIdx = i;
      else if (/>=\s*365.*impozit|>=\s*365.*tax/i.test(h)) longTaxIdx = i;
      else if (/<\s*365.*castig|<\s*365.*gain/i.test(h)) shortGainIdx = i;
      else if (/<\s*365.*pierdere|<\s*365.*loss/i.test(h)) shortLossIdx = i;
      else if (/<\s*365.*impozit|<\s*365.*tax/i.test(h)) shortTaxIdx = i;
      else if (/total.*impozabil|impozabil/i.test(h)) totalImpozabilIdx = i;
      else if (/total.*net|net$/i.test(h)) totalNetIdx = i;
    }

    // If headers weren't matched, try positional (Tradeville standard: 11 columns)
    if (countryIdx === -1 && rows[0].length >= 10) {
      // Positional fallback: 0=Nr, 1=Country, 2=Currency, 3-5=long, 6-8=short, 9=impozabil, 10=net
      for (let r = 1; r < rows.length; r++) {
        const row = rows[r];
        if (row.length < 10) continue;
        const country = (row[1] || '').trim();
        if (!/^[A-Z]{2,3}$/.test(country) && !/TOTAL/i.test(country)) continue;
        if (/TOTAL/i.test(country)) continue;

        const entry = {
          country,
          currency: (row[2] || 'RON').trim(),
          longGain: parseNumber(row[3]),
          longLoss: parseNumber(row[4]),
          longTax: parseNumber(row[5]),
          shortGain: parseNumber(row[6]),
          shortLoss: parseNumber(row[7]),
          shortTax: parseNumber(row[8]),
          totalImpozabil: parseNumber(row[9]),
          totalNet: parseNumber(row[10] || '0'),
        };
        result.countries.push(entry);
        result.longTerm.gainRON += entry.longGain;
        result.longTerm.lossRON += entry.longLoss;
        result.longTerm.taxWithheldRON += entry.longTax;
        result.shortTerm.gainRON += entry.shortGain;
        result.shortTerm.lossRON += entry.shortLoss;
        result.shortTerm.taxWithheldRON += entry.shortTax;
        result.totalGainImpozabilRON += entry.totalImpozabil;
        result.totalGainNetRON += entry.totalNet;
      }
      continue;
    }

    // Parse data rows using identified column indices
    for (let r = 1; r < rows.length; r++) {
      const row = rows[r];
      const country = countryIdx >= 0 ? (row[countryIdx] || '').trim() : '';
      if (!country || /TOTAL/i.test(country)) continue;
      if (!/^[A-Z]{2,3}$/.test(country)) continue;

      const entry = {
        country,
        currency: currencyIdx >= 0 ? (row[currencyIdx] || 'RON').trim() : 'RON',
        longGain: longGainIdx >= 0 ? parseNumber(row[longGainIdx]) : 0,
        longLoss: longLossIdx >= 0 ? parseNumber(row[longLossIdx]) : 0,
        longTax: longTaxIdx >= 0 ? parseNumber(row[longTaxIdx]) : 0,
        shortGain: shortGainIdx >= 0 ? parseNumber(row[shortGainIdx]) : 0,
        shortLoss: shortLossIdx >= 0 ? parseNumber(row[shortLossIdx]) : 0,
        shortTax: shortTaxIdx >= 0 ? parseNumber(row[shortTaxIdx]) : 0,
        totalImpozabil: totalImpozabilIdx >= 0 ? parseNumber(row[totalImpozabilIdx]) : 0,
        totalNet: totalNetIdx >= 0 ? parseNumber(row[totalNetIdx]) : 0,
      };

      result.countries.push(entry);
      result.longTerm.gainRON += entry.longGain;
      result.longTerm.lossRON += entry.longLoss;
      result.longTerm.taxWithheldRON += entry.longTax;
      result.shortTerm.gainRON += entry.shortGain;
      result.shortTerm.lossRON += entry.shortLoss;
      result.shortTerm.taxWithheldRON += entry.shortTax;
      result.totalGainImpozabilRON += entry.totalImpozabil;
      result.totalGainNetRON += entry.totalNet;
    }
  }

  result.totalTaxWithheldRON = result.longTerm.taxWithheldRON + result.shortTerm.taxWithheldRON;
  return result;
}

// Parse Fidelity Trade Confirmation PDF
function parseTradeConfirmation(text, year) {
  const isESPP = /ESPP/i.test(text);
  const isPurchase = /YOU PURCHASED/i.test(text);
  const isSold = /YOU SOLD/i.test(text);

  const result = {
    year,
    symbol: '',
    company: '',
    shares: 0,
    pricePerShare: 0,
    saleProceeds: 0,
    fees: 0,
    netProceeds: 0,
    saleDate: '',
    settlementDate: '',
    refNumber: '',
    participantId: '',
    transactionType: isPurchase ? 'purchase' : 'sale',
    isESPP: isESPP
  };

  if (isPurchase) {
    // "YOU PURCHASED 2.4179 AT $302.6900 PURCHASE PRICE"
    const purchMatch = text.match(/YOU PURCHASED\s+([\d.]+)\s+AT\s+\$?([\d.,]+)/i);
    if (purchMatch) {
      result.shares = parseFloat(purchMatch[1]);
      result.pricePerShare = parseNumber(purchMatch[2]);
    }

    // Purchase date from ESPP header: "MICROSOFT ESPP PLAN on DEC/31/2021."
    const purchDateMatch = text.match(/ESPP PLAN on\s+(\w+\/\d+\/\d+)/i);
    if (purchDateMatch) result.saleDate = purchDateMatch[1];

    // Offering period
    const offeringMatch = text.match(/Offering period:\s*(.+)/i);
    if (offeringMatch) result.offeringPeriod = offeringMatch[1].trim();

    // Dollar amounts after SYMBOL line: Market Value, Accumulated Contributions, Gain, Share Proceeds
    const amounts = [];
    const amtRegex = /\$[\d,]+\.\d{2}/g;
    // Skip the price in the "AT $302.69" line — get amounts after the symbol/company lines
    const symbolIdx = text.indexOf('SYMBOL:');
    const afterSymbol = symbolIdx >= 0 ? text.substring(symbolIdx) : text;
    let m;
    while ((m = amtRegex.exec(afterSymbol)) !== null) {
      amounts.push(parseNumber(m[0].replace('$', '')));
    }

    if (amounts.length >= 4) {
      result.marketValue = amounts[0];
      result.accumulatedContributions = amounts[1];
      result.esppGain = amounts[2];
      result.purchaseCost = amounts[3]; // = Accumulated Contributions used
    }

    // Compute cost basis (what was actually paid per share)
    result.saleProceeds = result.marketValue || 0;
    result.netProceeds = result.purchaseCost || (result.shares * result.pricePerShare);
  } else {
    // "YOU SOLD 2 AT 431.5000"
    const soldMatch = text.match(/YOU SOLD\s+([\d.]+)\s+AT\s+([\d.]+)/i);
    if (soldMatch) {
      result.shares = parseFloat(soldMatch[1]);
      result.pricePerShare = parseFloat(soldMatch[2]);
    }

    // Dollar amounts: Sale Proceeds, Fees, Net
    const amounts = text.match(/\$[\d,]+\.\d{2}/g);
    if (amounts && amounts.length >= 3) {
      result.saleProceeds = parseNumber(amounts[0].replace('$', ''));
      result.fees = parseNumber(amounts[1].replace('$', ''));
      result.netProceeds = Math.abs(parseNumber(amounts[2].replace(/[$-]/g, '')));
    }

    // Sale Date: "MAY/01/2025"
    const dateMatch = text.match(/Sale Date:\s*(\w+\/\d+\/\d+)/i);
    if (dateMatch) result.saleDate = dateMatch[1];

    // Settlement Date
    const settlMatch = text.match(/Proceeds Available:\s*(\w+\/\d+\/\d+)/i);
    if (settlMatch) result.settlementDate = settlMatch[1];
  }

  // Symbol
  const symbolMatch = text.match(/SYMBOL:\s*(\w+)/);
  if (symbolMatch) result.symbol = symbolMatch[1];

  // Company name (line after SYMBOL)
  const companyMatch = text.match(/SYMBOL:\s*\w+\s*\n(.+)/);
  if (companyMatch) result.company = companyMatch[1].trim();

  // Ref number
  const refMatch = text.match(/REF #\s*([\w-]+)/);
  if (refMatch) result.refNumber = refMatch[1];

  // Participant
  const partMatch = text.match(/PARTICIPANT.*?\n\s*(I\d+)/);
  if (partMatch) result.participantId = partMatch[1];

  return result;
}

// Parse Fidelity Stock Plan monthly statement
// Extracts: sales with FIFO cost basis, RSU vests, ESPP purchases, dividends, tax withheld
function parseFidelityStatement(text, year) {
  const result = {
    year,
    period: '',
    sales: [],
    vests: [],
    esppPurchases: [],
    dividends: [],
    taxWithheld: [],
    dividendsYTD: 0,
    taxWithheldYTD: 0,
    realizedGainYTD: 0,
    longTermGainYTD: 0,
    shortTermGainYTD: 0,
    endingValue: 0,
    holdingsQuantity: 0,
    holdingsCostBasis: 0,
    holdingsUnrealizedGain: 0,
    totalSaleProceeds: 0,
    totalCostBasis: 0,
    totalGain: 0,
    totalDividends: 0,
    totalTaxWithheld: 0,
    totalVestedShares: 0,
    totalEsppShares: 0,
  };

  const monthNames = ['JAN','FEB','MAR','APR','MAY','JUN','JUL','AUG','SEP','OCT','NOV','DEC'];
  function formatDate(mmdd) {
    if (!mmdd) return '';
    const parts = mmdd.split('/');
    const m = parseInt(parts[0], 10);
    if (m >= 1 && m <= 12) return `${monthNames[m-1]}/${parts[1]}/${year}`;
    return mmdd;
  }

  // Period
  const periodMatch = text.match(/((?:January|February|March|April|May|June|July|August|September|October|November|December)\s+\d+,\s+\d{4}\s*-\s*(?:January|February|March|April|May|June|July|August|September|October|November|December)\s+\d+,\s+\d{4})/);
  if (periodMatch) result.period = periodMatch[1];

  // ========= SALES: "You Sold" entries with cost basis =========
  const soldSection = text.split(/Securities Bought & Sold/i)[1]?.split(/(?:Dividends, Interest|Other Activity|Core Fund)/i)[0] || '';
  const soldLines = soldSection.split('\n');
  for (let i = 0; i < soldLines.length; i++) {
    if (!/You Sold/i.test(soldLines[i])) continue;

    // Look for gain type on the next line
    let gainAmount = 0, gainType = '';
    if (i + 1 < soldLines.length) {
      const gainMatch = soldLines[i + 1].match(/(Long-term|Short-term)\s+gain:\s+\$([\d.,]+)/i);
      if (gainMatch) {
        gainType = gainMatch[1].toLowerCase().includes('long') ? 'long-term' : 'short-term';
        gainAmount = parseNumber(gainMatch[2]);
      }
    }

    // Find data line: -shares price costBasis fee proceeds
    for (let j = i + 1; j < Math.min(i + 5, soldLines.length); j++) {
      const dataMatch = soldLines[j].match(/-([\d.]+)\s+\$?([\d.,]+)\s+\$?([\d.,]+)\s+-?\$?([\d.,]+)\s+\$?([\d.,]+)/);
      if (!dataMatch) continue;

      // Get date from earlier lines
      let saleDate = '';
      for (let k = Math.max(0, i - 2); k <= i; k++) {
        const dm = soldLines[k].match(/^t?\s*f?(\d{2}\/\d{2})/);
        if (dm) saleDate = dm[1];
      }

      const shares = parseFloat(dataMatch[1]);
      const pricePerShare = parseNumber(dataMatch[2]);
      const costBasisUSD = parseNumber(dataMatch[3]);
      const fees = parseNumber(dataMatch[4]);
      const netProceeds = parseNumber(dataMatch[5]);
      const saleProceeds = parseFloat((shares * pricePerShare).toFixed(2));

      const sale = {
        year,
        symbol: 'MSFT',
        shares,
        pricePerShare,
        saleProceeds,
        costBasisUSD,
        fees,
        netProceeds,
        saleDate: formatDate(saleDate),
        gainType,
        gainAmount,
        transactionType: 'sale',
        source: 'fidelity_statement',
      };
      result.sales.push(sale);
      result.totalSaleProceeds += netProceeds;
      result.totalCostBasis += costBasisUSD;
      result.totalGain += gainAmount;
      break;
    }
  }

  // ========= RSU VESTS: "SHARES DEPOSITED" in Other Activity In =========
  const oaiSection = text.split(/Other Activity In\s*\nSettlement/i)[1]?.split(/(?:Other Activity Out|Taxes Withheld|Core Fund|Estimated Cash)/i)[0] || '';
  const oaiLines = oaiSection.split('\n');
  for (let i = 0; i < oaiLines.length; i++) {
    if (!/SHARES DEPOSITED/i.test(oaiLines[i])) continue;

    // VALUE OF TRANSACTION on same or next line
    let valueUSD = 0;
    const valMatch = oaiLines[i].match(/VALUE OF TRANSACTION\s+\$([\d.,]+)/i)
      || (i + 1 < oaiLines.length && oaiLines[i + 1].match(/VALUE OF TRANSACTION\s+\$([\d.,]+)/i));
    if (valMatch) valueUSD = parseNumber(valMatch[1]);

    // Find conversion data: quantity + price
    for (let j = i; j < Math.min(i + 3, oaiLines.length); j++) {
      const convMatch = oaiLines[j].match(/Conversion\s+([\d.]+)\s+\$?([\d.,]+)/i);
      if (!convMatch) continue;

      let vestDate = '';
      for (let k = Math.max(0, i - 3); k <= i; k++) {
        const dm = oaiLines[k].match(/^(\d{2}\/\d{2})/);
        if (dm) vestDate = dm[1];
      }

      const shares = parseFloat(convMatch[1]);
      const pricePerShare = parseNumber(convMatch[2]);
      if (!valueUSD) valueUSD = parseFloat((shares * pricePerShare).toFixed(2));

      result.vests.push({
        date: formatDate(vestDate),
        shares,
        pricePerShare,
        valueUSD,
      });
      result.totalVestedShares += shares;
      break;
    }
  }

  // ========= ESPP PURCHASES: "You Bought" with ESPP in symbol =========
  const boughtSection = text.split(/Securities Bought & Sold/i)[1]?.split(/(?:Net Securities|Dividends|Other Activity)/i)[0] || '';
  const boughtLines = boughtSection.split('\n');
  for (let i = 0; i < boughtLines.length; i++) {
    if (!/You Bought/i.test(boughtLines[i]) || !/ESPP/i.test(boughtLines[i])) continue;

    // Data: quantity price - -amount
    for (let j = i; j < Math.min(i + 3, boughtLines.length); j++) {
      const buyMatch = boughtLines[j].match(/([\d.]+)\s+\$([\d.,]+)\s+.*?-\$?([\d.,]+)/);
      if (!buyMatch) continue;

      let buyDate = '';
      for (let k = Math.max(0, i - 2); k <= i; k++) {
        const dm = boughtLines[k].match(/^i?\s*(\d{2}\/\d{2})/);
        if (dm) buyDate = dm[1];
      }

      const shares = parseFloat(buyMatch[1]);
      const purchasePrice = parseNumber(buyMatch[2]);
      const costUSD = parseNumber(buyMatch[3]);

      result.esppPurchases.push({
        date: formatDate(buyDate),
        shares,
        purchasePrice,
        costUSD,
      });
      result.totalEsppShares += shares;
      break;
    }
  }

  // ESPP plan details (offering period section at end of statement)
  const esppSection = text.split(/Employee Stock Purchase Summary/i)[1]?.split(/Employee Contribution|Additional Information/i)[0] || '';
  if (esppSection) {
    const esppMatch = esppSection.match(/(\d{2}\/\d{2}\/\d{4}-\d{2}\/\d{2}\/\d{4})\s+Employee Purchase\s+(\d{2}\/\d{2}\/\d{4})\s+\$([\d.,]+)\s+\$([\d.,]+)\s+([\d.]+)\s+\$([\d.,]+)/);
    if (esppMatch && result.esppPurchases.length > 0) {
      const lastEspp = result.esppPurchases[result.esppPurchases.length - 1];
      lastEspp.offeringPeriod = esppMatch[1];
      lastEspp.fmv = parseNumber(esppMatch[4]);
      lastEspp.gainUSD = parseNumber(esppMatch[6]);
    }
  }

  // ========= DIVIDENDS: MICROSOFT CORP Dividend Received =========
  const divSection = text.split(/Dividends, Interest & Other Income/i)[1]?.split(/(?:Other Activity|Core Fund|Securities Transferred)/i)[0] || '';
  const divLines = divSection.split('\n');
  for (let i = 0; i < divLines.length; i++) {
    if (!/MICROSOFT CORP/i.test(divLines[i])) continue;
    // Look for "Dividend Received" and amount
    for (let j = i; j < Math.min(i + 3, divLines.length); j++) {
      if (!/Dividend Received/i.test(divLines[j])) continue;
      const amtMatch = divLines[j].match(/\$([\d.,]+)\s*$/);
      if (amtMatch) {
        let divDate = '';
        for (let k = Math.max(0, i - 1); k <= i; k++) {
          const dm = divLines[k].match(/^(\d{2}\/\d{2})/);
          if (dm) divDate = dm[1];
        }
        result.dividends.push({
          date: formatDate(divDate),
          amountUSD: parseNumber(amtMatch[1]),
        });
        result.totalDividends += parseNumber(amtMatch[1]);
      }
      break;
    }
  }

  // ========= TAX WITHHELD: Non-Resident Tax =========
  const taxSection = text.split(/Taxes Withheld\s*\nDate/i)[1]?.split(/(?:Core Fund|Estimated Cash|Additional)/i)[0] || '';
  const taxLines = taxSection.split('\n');
  for (let i = 0; i < taxLines.length; i++) {
    if (!/Non-Resident Tax/i.test(taxLines[i])) continue;
    const taxMatch = taxLines[i].match(/-?\$?([\d.,]+)\s*$/);
    if (taxMatch) {
      let taxDate = '';
      const dm = taxLines[i].match(/^(\d{2}\/\d{2})/);
      if (dm) taxDate = dm[1];
      result.taxWithheld.push({
        date: formatDate(taxDate),
        amountUSD: parseNumber(taxMatch[1]),
        description: 'Non-Resident Tax',
      });
      result.totalTaxWithheld += parseNumber(taxMatch[1]);
    }
  }

  // ========= YTD SUMMARIES =========
  // Income Summary: YTD dividends
  const incMatch = text.match(/Income Summary[\s\S]*?Total\s+\$([\d.,]+)\s+\$([\d.,]+)/);
  if (incMatch) result.dividendsYTD = parseNumber(incMatch[2]);

  // Taxes Withheld YTD (from Account Summary section)
  const taxYtdMatch = text.match(/Taxes Withheld\s+-\$?([\d.,]+)\s+-\$?([\d.,]+)/);
  if (taxYtdMatch) result.taxWithheldYTD = parseNumber(taxYtdMatch[2]);

  // Realized Gains YTD
  const gainBlock = text.match(/Net Gain\/Loss\s+(?:-|\$?[\d.,]+)\s+\$?([\d.,]+)/);
  if (gainBlock) result.realizedGainYTD = parseNumber(gainBlock[1]);
  const ltMatch = text.match(/Long-term Gain\s+(?:-|[\d.,]+)\s+([\d.,]+)/);
  if (ltMatch) result.longTermGainYTD = parseNumber(ltMatch[1]);
  const stMatch = text.match(/Short-term Gain\s+(?:-|[\d.,]+)\s+([\d.,]+)/);
  if (stMatch) result.shortTermGainYTD = parseNumber(stMatch[1]);

  // Ending Account Value
  const endMatch = text.match(/Ending.*?Account Value\s+\$([\d.,]+)\s+\$([\d.,]+)/);
  if (endMatch) result.endingValue = parseNumber(endMatch[2]);

  // MSFT holdings: quantity, cost basis, unrealized
  const msftMatch = text.match(/MICROSOFT CORP \(MSFT\)\s+\$([\d.,]+)\s+([\d.]+)\s+\$([\d.,]+)\s+\$([\d.,]+)\s+\$([\d.,]+)\s+\$?([\d.,]+|-[\d.,]+)/);
  if (msftMatch) {
    result.holdingsQuantity = parseFloat(msftMatch[2]);
    result.holdingsCostBasis = parseNumber(msftMatch[5]);
    result.holdingsUnrealizedGain = parseNumber(msftMatch[6]);
  } else {
    // Fallback: cost basis may be "unknown"
    const msftFallback = text.match(/MICROSOFT CORP \(MSFT\)\s+\$([\d.,]+)\s+([\d.]+)\s+\$([\d.,]+)\s+\$([\d.,]+)/);
    if (msftFallback) {
      result.holdingsQuantity = parseFloat(msftFallback[2]);
    }
  }

  return result;
}

// Parse stock award document (OCR text from screenshot/PDF)
// Looks for tabular data with a stock_withholding column
function parseStockAward(text, year) {
  const result = { year, rows: [], totalWithholding: 0 };
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
  const requiredCols = ['datastat', 'espp_gain_bik', 'stock_award_bik', 'stock_withholding', 'dinit'];

  // Find header row
  let headerIdx = -1;
  for (let i = 0; i < lines.length; i++) {
    if (/stock.?withholding|withholding/i.test(lines[i])) {
      headerIdx = i;
      break;
    }
  }

  if (headerIdx >= 0) {
    // Fix merged header columns (PDF sometimes extracts without spaces)
    let headerLine = lines[headerIdx]
      .replace(/espp_gain_bikstock_award_bik/gi, 'espp_gain_bik stock_award_bik')
      .replace(/stock_award_bikstock_withholding/gi, 'stock_award_bik stock_withholding')
      .replace(/stock_withholdingdinit/gi, 'stock_withholding dinit');
    const headerCols = headerLine.split(/\s{2,}|\t|\s/).map(c => c.trim().toLowerCase().replace(/\s+/g, '_')).filter(Boolean);
    for (let i = headerIdx + 1; i < lines.length; i++) {
      const line = lines[i];
      if (!line || /^\s*$/.test(line) || /^total|^sum/i.test(line)) continue;

      const dataCols = line.split(/\s{2,}|\t/);
      if (dataCols.length < 2) continue;

      // If single-space separated (PDF quirk), re-split by single space
      if (dataCols.length < headerCols.length) {
        const reSplit = line.split(/\s+/);
        if (reSplit.length >= headerCols.length - 2) {
          dataCols.length = 0;
          dataCols.push(...reSplit);
        }
      }

      // Map all columns
      const fullRow = {};
      for (let c = 0; c < headerCols.length && c < dataCols.length; c++) {
        fullRow[headerCols[c]] = dataCols[c].trim();
      }

      // Keep only required columns
      const row = {};
      for (const col of requiredCols) {
        if (fullRow[col] !== undefined) row[col] = fullRow[col];
      }

      // Get withholding value
      const wh = parseFloat((row.stock_withholding || '0').replace(/[^0-9.\-]/g, ''));
      const bik = parseFloat((row.stock_award_bik || '0').replace(/[^0-9.\-]/g, ''));
      const espp = parseFloat((row.espp_gain_bik || '0').replace(/[^0-9.\-]/g, ''));
      if (!isNaN(wh)) {
        row.stock_withholding = wh;
        row.stock_award_bik = !isNaN(bik) ? bik : 0;
        row.espp_gain_bik = !isNaN(espp) ? espp : 0;
        if (wh > 0 || bik > 0 || espp > 0) {
          result.totalWithholding += wh;
          result.rows.push(row);
        }
      }
    }
  }

  // Fallback: pattern match for Microsoft payroll format (OCR/PDF)
  // Use CNP (13-digit) as anchor to reliably locate the numeric columns
  // Supports: DD-Mon-YY, DD-Mon-YYYY, DD.MM.YYYY
  if (result.rows.length === 0) {
    for (const line of lines) {
      const m = line.match(/(\d{1,2}[.-](?:\w{3}|\d{2})[.-]\d{2,4})\s+.*?\b\d{13}\s+\w{2,4}\s+(\d+)\s+(\d+)\s+(\d+)/);
      if (m) {
        const espp = parseInt(m[2], 10);
        const bik = parseInt(m[3], 10);
        const wh = parseInt(m[4], 10);
        if (wh > 0 || bik > 0 || espp > 0) {
          result.rows.push({
            datastat: m[1],
            espp_gain_bik: espp,
            stock_award_bik: bik,
            stock_withholding: wh
          });
          result.totalWithholding += wh;
        }
      }
    }
  }

  // Save a clean raw text with only required columns from parsed results
  if (result.rows.length > 0) {
    const cleanHeader = requiredCols.join('\t');
    const cleanLines = ['Microsoft Romania', '', cleanHeader];
    // Build clean lines from the actual parsed rows (including all rows from OCR)
    // First, collect ALL rows (including zero withholding) from OCR fallback
    const allRows = [];
    for (const line of lines) {
      const m = line.match(/(\d{1,2}[.-](?:\w{3}|\d{2})[.-]\d{2,4})\s+.*?\b\d{13}\s+\w{2,4}\s+(\d+)\s+(\d+)\s+(\d+)/);
      if (m) {
        allRows.push({
          datastat: m[1], espp_gain_bik: m[2],
          stock_award_bik: m[3], stock_withholding: m[4], dinit: ''
        });
      }
    }
    // If we got rows from OCR fallback, use them
    if (allRows.length > 0) {
      for (const r of allRows) {
        cleanLines.push(requiredCols.map(c => r[c] || '0').join('\t'));
      }
    } else {
      // Use the non-zero rows we already parsed
      for (const r of result.rows) {
        cleanLines.push(requiredCols.map(c => String(r[c] || '0')).join('\t'));
      }
    }
    const rawFile = `stock_award_${year}_raw.txt`;
    fs.writeFileSync(path.join(DATA_DIR, rawFile), cleanLines.join('\n'), 'utf8');
  }

  return result;
}

// Server code checksum for restart detection
const serverCodeHash = require('crypto').createHash('md5').update(fs.readFileSync(__filename, 'utf8')).digest('hex');

// GET /api/server-hash - Return server code hash
app.get('/api/server-hash', (req, res) => {
  res.json({ hash: serverCodeHash });
});

// POST /api/restart - Restart the server
app.post('/api/restart', (req, res) => {
  res.json({ success: true, message: 'Server restarting...' });
  log('INFO', 'Server restart requested');
  setTimeout(() => {
    const { spawn } = require('child_process');
    const child = spawn(process.argv[0], [path.join(__dirname, 'server.js')], {
      cwd: __dirname,
      detached: true,
      stdio: 'ignore',
      windowsHide: true
    });
    child.unref();
    process.exit(0);
  }, 500);
});

// POST /api/ocr-downgrade - Remove PaddleOCR (python/ folder) and restart
app.post('/api/ocr-downgrade', (req, res) => {
  const pythonDir = path.join(__dirname, 'python');
  if (!fs.existsSync(pythonDir)) {
    return res.json({ success: false, error: 'PaddleOCR is not installed (no python/ folder found).' });
  }
  try {
    fs.rmSync(pythonDir, { recursive: true, force: true });
    _paddleOcrAvailable = null; // reset cache
    _pythonSizeMB = null; // python dir removed
    // Re-detect so /api/ocr-status reflects the new state immediately
    detectPaddleOcrAsync();
    log('INFO', 'PaddleOCR downgraded — python/ folder removed');
    res.json({ success: true });
  } catch (err) {
    log('ERROR', 'Failed to remove python/ folder: ' + err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/ocr-upgrade - Install PaddleOCR (run setup_paddleocr.js)
app.post('/api/ocr-upgrade', (req, res) => {
  // Fresh check (ignore cache) — user explicitly wants to install
  _paddleOcrAvailable = null;
  const status = checkPaddleOcrAvailable();
  if (status.available) {
    return res.json({ success: false, error: 'PaddleOCR is already installed.' });
  }
  _paddleOcrAvailable = null; // reset again so post-install check is fresh
  _upgradeInProgress = true;
  log('INFO', 'PaddleOCR upgrade requested — starting installation...');
  const { execFile: ef } = require('child_process');
  ef(process.execPath, [path.join(__dirname, 'setup_paddleocr.js'), '--target', __dirname], {
    cwd: __dirname,
    timeout: 600000,
    maxBuffer: 50 * 1024 * 1024,
    windowsHide: true,
  }, (err, stdout, stderr) => {
    _upgradeInProgress = false;
    if (err) {
      log('ERROR', 'PaddleOCR upgrade failed: ' + err.message);
      log('ERROR', stderr || stdout);
      return res.status(500).json({ success: false, error: 'Installation failed. Check server logs for details.' });
    }
    _paddleOcrAvailable = null;
    log('INFO', 'PaddleOCR upgrade complete');
    // Re-detect PaddleOCR so /api/ocr-status reflects the new state
    detectPaddleOcrAsync();
    setImmediate(computePythonSizeMB); // recompute cached size
    res.json({ success: true });
  });
});

// Serve the main page for all non-API routes
app.get('/{*splat}', (req, res) => {
  if (!req.path.startsWith('/api')) {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
  }
});

app.listen(PORT, (err) => {
  if (err) {
    log('ERROR', 'Failed to start server', { error: err.message });
    console.error(`  Error: ${err.message}`);
    process.exit(1);
  }
  log('INFO', 'Server started', { port: PORT, url: `http://localhost:${PORT}` });
  console.log(`\n  D212 Tax Helper running at http://localhost:${PORT}\n`);

  // Auto-migrate JSON files to SQLite on first run
  try {
    const migResult = db.autoMigrate(DATA_DIR);
    if (migResult) {
      log('INFO', 'SQLite migration completed', migResult);
      console.log(`  DB: migrated from JSON → SQLite (${migResult.trades} trades, ${migResult.stockAwards} stock awards)`);
    }
  } catch (err) {
    log('ERROR', 'SQLite migration failed', { error: err.message });
  }

  // Auto-migrate existing data to ledger (from trades.json / stock_awards.json into ledger tables)
  const ldg = db.loadLedger();
  if (ldg.entries.length === 0) {
    try {
      const result = ledger.migrateFromExisting(DATA_DIR);
      if (result.trades > 0 || result.vests > 0) {
        log('INFO', 'Ledger migration completed', result);
        console.log(`  Ledger: migrated ${result.trades} trades, ${result.vests} vests`);
      }
    } catch (err) {
      log('ERROR', 'Ledger migration failed', { error: err.message });
    }
  }
});
