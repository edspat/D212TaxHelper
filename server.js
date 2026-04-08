const express = require('express');
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const pdfParse = require('pdf-parse-new');
const { execFile } = require('child_process');
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

function findPython() {
  for (const p of PYTHON_PATHS) {
    try {
      const resolved = path.isAbsolute(p) ? p : p;
      if (path.isAbsolute(p) && !fs.existsSync(p)) continue;
      require('child_process').execFileSync(resolved, ['--version'], { stdio: 'pipe', timeout: 5000 });
      return resolved;
    } catch { /* try next */ }
  }
  return null;
}

function checkPaddleOcrAvailable() {
  if (_paddleOcrAvailable !== null) return _paddleOcrAvailable;

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
      stdio: 'pipe', timeout: 30000,
      env: { ...process.env, PADDLE_PDX_DISABLE_MODEL_SOURCE_CHECK: 'True', GLOG_minloglevel: '2' }
    });
    _paddleOcrAvailable = { available: true, python: pythonExe };
  } catch (err) {
    _paddleOcrAvailable = { available: false, reason: 'PaddleOCR not installed', python: pythonExe };
  }

  return _paddleOcrAvailable;
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

// Detect PaddleOCR availability at startup (non-blocking)
setImmediate(() => {
  const status = checkPaddleOcrAvailable();
  log('INFO', 'OCR engine detection', {
    paddleocr: status.available,
    detail: status.reason || 'ready',
    python: status.python || null,
  });
  console.log(`  OCR Engine: ${status.available ? 'PaddleOCR (PP-StructureV3)' : 'Tesseract.js (PaddleOCR not available: ' + (status.reason || 'unknown') + ')'}`);
});

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
app.use(express.json());
app.use((req, res, next) => {
  if (req.path.startsWith('/api')) log('INFO', `${req.method} ${req.path}`, req.method === 'POST' ? { type: req.query.type || req.body?.type } : undefined);
  next();
});
app.use(express.static(path.join(__dirname, 'public')));

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

// GET /api/ocr-status - Return OCR engine availability
app.get('/api/ocr-status', (req, res) => {
  const paddle = checkPaddleOcrAvailable();
  res.json({
    paddleocr: paddle.available,
    paddleocrDetail: paddle.reason || null,
    tesseract: true, // always available (bundled via tesseract.js)
    engine: paddle.available ? 'paddleocr' : 'tesseract',
  });
});

// GET /api/data - Return all financial data
app.get('/api/data', (req, res) => {
  try {
    const dataFile = path.join(DATA_DIR, 'parsed_data.json');
    if (!fs.existsSync(dataFile)) {
      return res.json({ years: {} });
    }
    const data = JSON.parse(fs.readFileSync(dataFile, 'utf8'));

    // Also load stock awards if available
    const stockFile = path.join(DATA_DIR, 'stock_awards.json');
    if (fs.existsSync(stockFile)) {
      data.stockAwards = JSON.parse(fs.readFileSync(stockFile, 'utf8'));
    }

    // Load metadata
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
    const dataFile = path.join(DATA_DIR, 'parsed_data.json');
    if (!fs.existsSync(dataFile)) {
      return res.json(null);
    }
    const data = JSON.parse(fs.readFileSync(dataFile, 'utf8'));
    res.json(data.years[year] || null);
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
    const dataFile = path.join(DATA_DIR, 'parsed_data.json');
    let data = { years: {} };
    if (fs.existsSync(dataFile)) {
      data = JSON.parse(fs.readFileSync(dataFile, 'utf8'));
    }
    data.years[year] = { ...data.years[year], ...req.body, year };
    fs.writeFileSync(dataFile, JSON.stringify(data, null, 2), 'utf8');
    res.json({ success: true, data: data.years[year] });
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
      const year = parts[2];
      const dataFile = path.join(DATA_DIR, 'parsed_data.json');
      if (fs.existsSync(dataFile)) {
        const data = JSON.parse(fs.readFileSync(dataFile, 'utf8'));
        if (data.years && data.years[year]) {
          // Remove matching type from year data
          if (data.years[year][type]) {
            delete data.years[year][type];
          }
          // Handle special naming conventions
          if (type === 'xtb_dividends' && data.years[year].xtbDividendsReport) {
            delete data.years[year].xtbDividendsReport;
          }
          if (type === 'xtb_portfolio' && data.years[year].xtbPortfolio) {
            delete data.years[year].xtbPortfolio;
          }
          if (type === 'tradeville_portfolio' && data.years[year].tradevillePortfolio) {
            delete data.years[year].tradevillePortfolio;
          }
          if (type === 'fidelity_statement' && data.years[year].fidelityTransfers) {
            delete data.years[year].fidelityTransfers;
            delete data.years[year].fidelityDividendsYTD;
            delete data.years[year].fidelityTrades;
          }
          if (type === 'ms_statement' && data.years[year].msStatement) {
            delete data.years[year].msStatement;
            delete data.years[year].msDividends;
            delete data.years[year].msTaxWithheld;
            delete data.years[year].fidelityTrades;
          }
          // form_1042s raw file key → form1042s in parsed data
          if (type === 'form_1042s') {
            delete data.years[year].form1042s;
          }
          if (type === 'trade_confirmation' && data.years[year].fidelityTrades) {
            delete data.years[year].fidelityTrades;
          }
          // Clear stock_awards.json when stock_award raw file is purged
          if (type === 'stock_award') {
            const stockFile = path.join(DATA_DIR, 'stock_awards.json');
            if (fs.existsSync(stockFile)) {
              fs.writeFileSync(stockFile, JSON.stringify({ 'Stock Awards': [] }, null, 2), 'utf8');
            }
          }
          // Clear trades from trades.json based on source
          if (type === 'trade_confirmation' || type === 'ms_statement' || type === 'fidelity_statement') {
            const tradesFile = path.join(DATA_DIR, 'trades.json');
            if (fs.existsSync(tradesFile)) {
              const raw = JSON.parse(fs.readFileSync(tradesFile, 'utf8'));
              const trades = Array.isArray(raw.trades) ? raw.trades : [];
              let filtered;
              if (type === 'ms_statement') {
                filtered = trades.filter(t => t.source !== 'ms_statement');
              } else if (type === 'fidelity_statement') {
                filtered = trades.filter(t => t.source !== 'fidelity_statement');
              } else {
                // trade_confirmation: remove trades without a source (legacy) or with no source field
                filtered = trades.filter(t => t.source === 'ms_statement' || t.source === 'fidelity_statement');
              }
              fs.writeFileSync(tradesFile, JSON.stringify({ trades: filtered }, null, 2), 'utf8');

              // Recalculate fidelityTrades aggregate for this year
              const yearTrades = filtered.filter(t => t.year === parseInt(year, 10));
              if (yearTrades.length > 0) {
                data.years[year].fidelityTrades = {
                  count: yearTrades.length,
                  totalProceeds: yearTrades.reduce((s, t) => s + (t.saleProceeds || 0), 0),
                  totalFees: yearTrades.reduce((s, t) => s + (t.fees || 0), 0),
                  totalNet: yearTrades.reduce((s, t) => s + (t.netProceeds || 0), 0),
                  totalShares: yearTrades.reduce((s, t) => s + (t.shares || 0), 0),
                  trades: yearTrades
                };
              } else if (data.years[year]) {
                delete data.years[year].fidelityTrades;
              }
            }
          }
          // Clean up empty year objects
          if (data.years[year] && Object.keys(data.years[year]).filter(k => k !== 'year').length === 0) {
            delete data.years[year];
          }
          fs.writeFileSync(dataFile, JSON.stringify(data, null, 2), 'utf8');
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
    const validTypes = ['declaratie', 'investment', 'adeverinta', 'stock_award', 'trade_confirmation', 'xtb_dividends', 'xtb_portfolio', 'fidelity_statement', 'form_1042s', 'ms_statement', 'tradeville_portfolio'];
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

    // Types that benefit from PaddleOCR table extraction
    const TABLE_TYPES = ['tradeville_portfolio', 'investment', 'declaratie', 'fidelity_statement', 'ms_statement'];
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

      // Check if PDF is image-based (scanned) or has very little text
      if (text.replace(/\s/g, '').length < 50) {
        console.log('PDF appears to be image-based (extracted only ' + text.trim().length + ' chars), falling back to OCR...');

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
      } else if (preferPaddleOcr && paddleStatus.available) {
        // Even for text-based PDFs, run PaddleOCR in table mode for table-heavy documents
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
    const SELF_VALIDATED_TYPES = ['tradeville_portfolio', 'trade_confirmation', 'fidelity_statement', 'form_1042s', 'ms_statement', 'xtb_dividends', 'xtb_portfolio', 'stock_award'];
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

    // Save raw text (append for trade confirmations, overwrite for others)
    const rawFile = `${type}_${parsedYear}_raw.txt`;
    const rawPath = path.join(DATA_DIR, rawFile);
    if (type === 'trade_confirmation' && fs.existsSync(rawPath)) {
      fs.appendFileSync(rawPath, '\n\n--- NEW TRADE CONFIRMATION ---\n\n' + text, 'utf8');
    } else {
      fs.writeFileSync(rawPath, text, 'utf8');
    }

    // Clean up uploaded file (and PaddleOCR extension copy if created)
    fs.unlinkSync(req.file.path);
    if (paddleFilePath !== req.file.path && fs.existsSync(paddleFilePath)) {
      fs.unlinkSync(paddleFilePath);
    }

    // Stock award documents get special handling
    if (type === 'stock_award') {
      const stockData = parseStockAward(text, parsedYear);
      fs.writeFileSync(path.join(DATA_DIR, 'stock_awards.json'), JSON.stringify({ 'Stock Awards': stockData.rows }, null, 2), 'utf8');
      return res.json({ success: true, year: parsedYear, type, parsed: stockData });
    }

    // Trade confirmations get appended (multiple files per year)
    if (type === 'trade_confirmation') {
      const trade = parseTradeConfirmation(text, parsedYear);
      const tradesFile = path.join(DATA_DIR, 'trades.json');
      let trades = { trades: [] };
      if (fs.existsSync(tradesFile)) {
        const raw = JSON.parse(fs.readFileSync(tradesFile, 'utf8'));
        trades = { trades: Array.isArray(raw.trades) ? raw.trades : [] };
      }
      // Avoid duplicates by checking ref number
      const isDuplicate = trade.refNumber && trades.trades.some(t => t.refNumber === trade.refNumber);
      if (!isDuplicate) {
        trades.trades.push(trade);
        fs.writeFileSync(tradesFile, JSON.stringify(trades, null, 2), 'utf8');
      }
      // Also update parsed_data with totals
      const dataFile2 = path.join(DATA_DIR, 'parsed_data.json');
      let data2 = { years: {} };
      if (fs.existsSync(dataFile2)) {
        data2 = JSON.parse(fs.readFileSync(dataFile2, 'utf8'));
      }
      if (!data2.years[parsedYear]) data2.years[parsedYear] = { year: parsedYear };
      // Aggregate all trades for this year
      const yearTrades = trades.trades.filter(t => t.year === parsedYear);
      data2.years[parsedYear].fidelityTrades = {
        count: yearTrades.length,
        totalProceeds: yearTrades.reduce((s, t) => s + (t.saleProceeds || 0), 0),
        totalFees: yearTrades.reduce((s, t) => s + (t.fees || 0), 0),
        totalNet: yearTrades.reduce((s, t) => s + (t.netProceeds || 0), 0),
        totalShares: yearTrades.reduce((s, t) => s + (t.shares || 0), 0),
        trades: yearTrades
      };
      fs.writeFileSync(dataFile2, JSON.stringify(data2, null, 2), 'utf8');
      return res.json({ success: true, year: parsedYear, type, parsed: trade, isDuplicate, yearSummary: data2.years[parsedYear].fidelityTrades });
    }

    // XTB Dividends & Interest report
    if (type === 'xtb_dividends') {
      const parsed = parseXtbDividends(text, parsedYear);
      const dataFile3 = path.join(DATA_DIR, 'parsed_data.json');
      let data3 = { years: {} };
      if (fs.existsSync(dataFile3)) data3 = JSON.parse(fs.readFileSync(dataFile3, 'utf8'));
      if (!data3.years[parsedYear]) data3.years[parsedYear] = { year: parsedYear };
      data3.years[parsedYear].xtbDividendsReport = parsed;
      fs.writeFileSync(dataFile3, JSON.stringify(data3, null, 2), 'utf8');
      return res.json({ success: true, year: parsedYear, type, parsed });
    }

    // XTB Portfolio (Capital Gains)
    if (type === 'xtb_portfolio') {
      const parsed = parseXtbPortfolio(text, parsedYear);
      const dataFile3 = path.join(DATA_DIR, 'parsed_data.json');
      let data3 = { years: {} };
      if (fs.existsSync(dataFile3)) data3 = JSON.parse(fs.readFileSync(dataFile3, 'utf8'));
      if (!data3.years[parsedYear]) data3.years[parsedYear] = { year: parsedYear };
      data3.years[parsedYear].xtbPortfolio = parsed;
      fs.writeFileSync(dataFile3, JSON.stringify(data3, null, 2), 'utf8');
      return res.json({ success: true, year: parsedYear, type, parsed });
    }

    // Fidelity Statement (periodic report with sales, transfers, dividends)
    if (type === 'fidelity_statement') {
      const parsed = parseFidelityStatement(text, parsedYear);

      // Load existing trades for dedup
      const tradesFile = path.join(DATA_DIR, 'trades.json');
      let trades = { trades: [] };
      if (fs.existsSync(tradesFile)) {
        const raw = JSON.parse(fs.readFileSync(tradesFile, 'utf8'));
        trades = { trades: Array.isArray(raw.trades) ? raw.trades : [] };
      }

      // Dedup sales: match by date + shares + netProceeds (or refNumber)
      let newTradesAdded = 0;
      let duplicatesSkipped = 0;
      for (const sale of parsed.sales) {
        const isDup = trades.trades.some(t =>
          (t.refNumber && sale.refNumber && t.refNumber === sale.refNumber) ||
          (t.saleDate === sale.saleDate && Math.abs(t.shares - sale.shares) < 0.001 && Math.abs(t.netProceeds - sale.netProceeds) < 0.01)
        );
        if (!isDup) {
          trades.trades.push(sale);
          newTradesAdded++;
        } else {
          duplicatesSkipped++;
        }
      }
      fs.writeFileSync(tradesFile, JSON.stringify(trades, null, 2), 'utf8');

      // Update parsed_data with statement info + trade totals
      const dataFile4 = path.join(DATA_DIR, 'parsed_data.json');
      let data4 = { years: {} };
      if (fs.existsSync(dataFile4)) data4 = JSON.parse(fs.readFileSync(dataFile4, 'utf8'));
      if (!data4.years[parsedYear]) data4.years[parsedYear] = { year: parsedYear };

      // Save transfers and statement metadata
      if (!data4.years[parsedYear].fidelityTransfers) data4.years[parsedYear].fidelityTransfers = [];
      for (const tr of parsed.transfers) {
        const trDup = data4.years[parsedYear].fidelityTransfers.some(
          e => e.date === tr.date && Math.abs(e.quantity - tr.quantity) < 0.001
        );
        if (!trDup) data4.years[parsedYear].fidelityTransfers.push(tr);
      }

      // Update fidelity dividends YTD if higher than current
      if (parsed.dividendsYTD > 0) {
        data4.years[parsedYear].fidelityDividendsYTD = parsed.dividendsYTD;
      }

      // Recalculate trade aggregates
      const yearTrades = trades.trades.filter(t => t.year === parsedYear);
      data4.years[parsedYear].fidelityTrades = {
        count: yearTrades.length,
        totalProceeds: yearTrades.reduce((s, t) => s + (t.saleProceeds || 0), 0),
        totalFees: yearTrades.reduce((s, t) => s + (t.fees || 0), 0),
        totalNet: yearTrades.reduce((s, t) => s + (t.netProceeds || 0), 0),
        totalShares: yearTrades.reduce((s, t) => s + (t.shares || 0), 0),
        trades: yearTrades
      };

      fs.writeFileSync(dataFile4, JSON.stringify(data4, null, 2), 'utf8');
      return res.json({
        success: true, year: parsedYear, type, parsed,
        newTradesAdded, duplicatesSkipped,
        totalTrades: yearTrades.length,
        transfers: data4.years[parsedYear].fidelityTransfers
      });
    }

    // Form 1042-S (US tax withholding on foreign person's income)
    if (type === 'form_1042s') {
      const parsed = parseForm1042S(text, parsedYear);
      const dataFile5 = path.join(DATA_DIR, 'parsed_data.json');
      let data5 = { years: {} };
      if (fs.existsSync(dataFile5)) data5 = JSON.parse(fs.readFileSync(dataFile5, 'utf8'));
      if (!data5.years[parsedYear]) data5.years[parsedYear] = { year: parsedYear };
      if (!data5.years[parsedYear].form1042s) data5.years[parsedYear].form1042s = [];
      // Dedup by unique form identifier
      const isDuplicate = parsed.uniqueFormId && data5.years[parsedYear].form1042s.some(f => f.uniqueFormId === parsed.uniqueFormId);
      if (!isDuplicate) {
        data5.years[parsedYear].form1042s.push(parsed);
      }
      fs.writeFileSync(dataFile5, JSON.stringify(data5, null, 2), 'utf8');
      return res.json({ success: true, year: parsedYear, type, parsed, isDuplicate });
    }

    // Morgan Stanley Stock Plan Statement (yearly)
    if (type === 'ms_statement') {
      const parsed = parseMSStatement(text, parsedYear);

      // Load existing trades for dedup
      const tradesFile = path.join(DATA_DIR, 'trades.json');
      let trades = { trades: [] };
      if (fs.existsSync(tradesFile)) {
        const raw = JSON.parse(fs.readFileSync(tradesFile, 'utf8'));
        trades = { trades: Array.isArray(raw.trades) ? raw.trades : [] };
      }

      // Add sales as trades (dedup by date + shares + netProceeds)
      let newTradesAdded = 0;
      let duplicatesSkipped = 0;
      for (const sale of parsed.sales) {
        const isDup = trades.trades.some(t =>
          t.saleDate === sale.saleDate && Math.abs(t.shares - sale.shares) < 0.001 && Math.abs(t.netProceeds - sale.netProceeds) < 0.01
        );
        if (!isDup) {
          trades.trades.push(sale);
          newTradesAdded++;
        } else {
          duplicatesSkipped++;
        }
      }
      fs.writeFileSync(tradesFile, JSON.stringify(trades, null, 2), 'utf8');

      // Update parsed_data
      const dataFile6 = path.join(DATA_DIR, 'parsed_data.json');
      let data6 = { years: {} };
      if (fs.existsSync(dataFile6)) data6 = JSON.parse(fs.readFileSync(dataFile6, 'utf8'));
      if (!data6.years[parsedYear]) data6.years[parsedYear] = { year: parsedYear };

      // Save MS statement summary
      data6.years[parsedYear].msStatement = {
        period: parsed.period,
        dividends: parsed.dividends,
        taxWithheld: parsed.taxWithheld,
        releases: parsed.releases,
        closingValue: parsed.closingValue,
        closingShares: parsed.closingShares
      };

      // Update dividends if present
      if (parsed.dividends > 0) {
        data6.years[parsedYear].msDividends = parsed.dividends;
        data6.years[parsedYear].msTaxWithheld = parsed.taxWithheld;
      }

      // Recalculate trade aggregates (include MS trades)
      const yearTrades = trades.trades.filter(t => t.year === parsedYear);
      data6.years[parsedYear].fidelityTrades = {
        count: yearTrades.length,
        totalProceeds: yearTrades.reduce((s, t) => s + (t.saleProceeds || 0), 0),
        totalFees: yearTrades.reduce((s, t) => s + (t.fees || 0), 0),
        totalNet: yearTrades.reduce((s, t) => s + (t.netProceeds || 0), 0),
        totalShares: yearTrades.reduce((s, t) => s + (t.shares || 0), 0),
        trades: yearTrades
      };

      fs.writeFileSync(dataFile6, JSON.stringify(data6, null, 2), 'utf8');
      return res.json({
        success: true, year: parsedYear, type, parsed,
        newTradesAdded, duplicatesSkipped,
        totalTrades: yearTrades.length
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
      const dataFile7 = path.join(DATA_DIR, 'parsed_data.json');
      let data7 = { years: {} };
      if (fs.existsSync(dataFile7)) data7 = JSON.parse(fs.readFileSync(dataFile7, 'utf8'));
      if (!data7.years[parsedYear]) data7.years[parsedYear] = { year: parsedYear };
      data7.years[parsedYear].tradevillePortfolio = parsed;
      data7.years[parsedYear].tradevillePortfolio.ocrEngine = ocrEngine;
      fs.writeFileSync(dataFile7, JSON.stringify(data7, null, 2), 'utf8');
      return res.json({ success: true, year: parsedYear, type, parsed, ocrEngine });
    }

    // Update parsed data
    const dataFile = path.join(DATA_DIR, 'parsed_data.json');
    let data = { years: {} };
    if (fs.existsSync(dataFile)) {
      data = JSON.parse(fs.readFileSync(dataFile, 'utf8'));
    }
    if (!data.years[parsedYear]) {
      data.years[parsedYear] = { year: parsedYear };
    }

    // Parse based on type
    const parsed = parsePdfText(text, type, parsedYear);
    data.years[parsedYear][type] = parsed;
    fs.writeFileSync(dataFile, JSON.stringify(data, null, 2), 'utf8');

    res.json({ success: true, year: parsedYear, type, parsed, ocrEngine });
  } catch (err) {
    log('ERROR', 'Upload processing failed', { error: err.message, type: req.body?.type, year: req.body?.year });
    res.status(500).json({ error: err.message });
  }
});

// GET /api/stock-withholding - Get stock withholding summary
app.get('/api/stock-withholding', (req, res) => {
  try {
    const stockFile = path.join(DATA_DIR, 'stock_awards.json');
    if (!fs.existsSync(stockFile)) {
      return res.json({ total: 0, rows: [] });
    }
    const excelData = JSON.parse(fs.readFileSync(stockFile, 'utf8'));
    let total = 0;
    const rows = [];
    for (const sheetName of Object.keys(excelData)) {
      for (const row of excelData[sheetName]) {
        if (row.stock_withholding !== undefined && row.stock_withholding !== null) {
          const val = parseFloat(row.stock_withholding);
          if (!isNaN(val)) {
            total += val;
            rows.push(row);
          }
        }
      }
    }
    res.json({ total, rows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/trades - Get all Fidelity trade confirmations
app.get('/api/trades', (req, res) => {
  try {
    const tradesFile = path.join(DATA_DIR, 'trades.json');
    if (!fs.existsSync(tradesFile)) {
      return res.json({ trades: [] });
    }
    const data = JSON.parse(fs.readFileSync(tradesFile, 'utf8'));
    const yearFilter = req.query.year ? parseInt(req.query.year, 10) : null;
    const trades = yearFilter ? data.trades.filter(t => t.year === yearFilter) : data.trades;
    const totalProceeds = trades.reduce((s, t) => s + (t.saleProceeds || 0), 0);
    const totalNet = trades.reduce((s, t) => s + (t.netProceeds || 0), 0);
    const totalShares = trades.reduce((s, t) => s + (t.shares || 0), 0);
    res.json({ trades, totalProceeds, totalNet, totalShares, count: trades.length });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/version - App version
app.get('/api/version', (req, res) => {
  const pkg = JSON.parse(fs.readFileSync(path.join(__dirname, 'package.json'), 'utf8'));
  res.json({ version: pkg.version, name: pkg.name });
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
    cassInfo: {
      minSalary2025: 4050,
      note: 'CAS (pension 25%) does NOT apply for investment income. CASS uses tiered brackets.',
      tiers: [
        { label: '<6SM (<24,300)', cass: 0 },
        { label: '6-12SM (24,300-48,600)', cass: 2430 },
        { label: '12-24SM (48,600-97,200)', cass: 4860 },
        { label: '24-60SM (97,200-243,000)', cass: 9720 },
        { label: '>60SM (>243,000)', cass: 24300 },
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

// Parse Fidelity Stock Plan Services Statement (periodic report)
function parseFidelityStatement(text, year) {
  const result = {
    year,
    period: '',
    sales: [],
    transfers: [],
    dividendsYTD: 0,
    realizedGainLoss: 0,
    endingValue: 0,
    holdingsQuantity: 0
  };

  // Period
  const periodMatch = text.match(/((?:January|February|March|April|May|June|July|August|September|October|November|December)\s+\d+,\s+\d{4}\s*-\s*(?:January|February|March|April|May|June|July|August|September|October|November|December)\s+\d+,\s+\d{4})/);
  if (periodMatch) result.period = periodMatch[1];

  // Securities Sold: parse each "You Sold" entry
  // Pattern: "MM/DD MICROSOFT CORP 594918104 You Sold\nLong-term gain: $X\n-Q PRICE COST FEE NET"
  const soldSection = text.split(/Securities Bought & Sold/i)[1]?.split(/Securities Transferred/i)[0] || '';
  const soldLines = soldSection.split('\n');
  for (let i = 0; i < soldLines.length; i++) {
    if (/You Sold/i.test(soldLines[i])) {
      // Try to get gain info from next line
      let gainAmount = 0;
      let gainType = '';
      if (i + 1 < soldLines.length) {
        const gainMatch = soldLines[i + 1].match(/(Long-term|Short-term)\s+gain:\s+\$([\d.,]+)/i);
        if (gainMatch) {
          gainType = gainMatch[1].toLowerCase().includes('long') ? 'long-term' : 'short-term';
          gainAmount = parseNumber(gainMatch[2]);
        }
      }
      // Get the data line (shares, price, cost, fee, amount)
      for (let j = i + 1; j < Math.min(i + 4, soldLines.length); j++) {
        const dataMatch = soldLines[j].match(/-([\d.]+)\s+\$?([\d.,]+)\s+\$?([\d.,]+)\s+-?\$?([\d.,]+)\s+\$?([\d.,]+)/);
        if (dataMatch) {
          // Get date from earlier lines
          let saleDate = '';
          for (let k = Math.max(0, i - 2); k <= i; k++) {
            const dateM = soldLines[k].match(/^t?\s*f?(\d{2}\/\d{2})/);
            if (dateM) saleDate = dateM[1];
          }
          // Convert MM/DD to month name format like trade confirmations use
          const monthNames = ['JAN','FEB','MAR','APR','MAY','JUN','JUL','AUG','SEP','OCT','NOV','DEC'];
          let saleDateFormatted = saleDate;
          if (saleDate) {
            const parts = saleDate.split('/');
            const m = parseInt(parts[0], 10);
            if (m >= 1 && m <= 12) saleDateFormatted = `${monthNames[m-1]}/${parts[1]}/${year}`;
          }

          const sale = {
            year,
            symbol: 'MSFT',
            company: 'MICROSOFT CORP',
            shares: parseFloat(dataMatch[1]),
            pricePerShare: parseNumber(dataMatch[2]),
            costBasis: parseNumber(dataMatch[3]),
            fees: parseNumber(dataMatch[4]),
            netProceeds: parseNumber(dataMatch[5]),
            saleProceeds: parseFloat(dataMatch[1]) * parseNumber(dataMatch[2]),
            saleDate: saleDateFormatted,
            gainType,
            gainAmount,
            source: 'fidelity_statement'
          };
          // Recalculate proceeds more accurately
          sale.saleProceeds = parseFloat((sale.shares * sale.pricePerShare).toFixed(2));
          result.sales.push(sale);
          break;
        }
      }
    }
  }

  // Securities Transferred Out
  const transferSection = text.split(/Securities Transferred Out/i)[1]?.split(/Dividends|Other Activity/i)[0] || '';
  const transferLines = transferSection.split('\n');
  for (let i = 0; i < transferLines.length; i++) {
    const deliverMatch = transferLines[i].match(/Delivered/i);
    if (deliverMatch) {
      // Look for quantity and price in nearby lines
      for (let j = Math.max(0, i - 3); j <= Math.min(i + 3, transferLines.length - 1); j++) {
        const qtyMatch = transferLines[j].match(/-([\d.]+)\s+\$([\d.,]+)/);
        if (qtyMatch) {
          let date = '';
          for (let k = Math.max(0, i - 5); k <= i; k++) {
            const dm = transferLines[k].match(/(\d{2}\/\d{2})/);
            if (dm) { date = dm[1]; break; }
          }
          // Get transfer value
          let value = 0;
          const valMatch = transferSection.match(/VALUE OF TRANSACTION\s*\$([\d.,]+)/i);
          if (valMatch) value = parseNumber(valMatch[1]);

          result.transfers.push({
            date,
            symbol: 'MSFT',
            quantity: parseFloat(qtyMatch[1]),
            pricePerShare: parseNumber(qtyMatch[2]),
            value: value || parseFloat(qtyMatch[1]) * parseNumber(qtyMatch[2]),
            destination: 'XTB',
            year
          });
          break;
        }
      }
    }
  }

  // Dividends YTD
  const divYtdMatch = text.match(/Dividends[\s\S]*?Year-to-Date[\s\S]*?\$([\d.,]+)/);
  if (divYtdMatch) result.dividendsYTD = parseNumber(divYtdMatch[1]);
  // Fallback: look for "Total $X.XX $Y.YY" in Income Summary
  const divTotalMatch = text.match(/Total\s+\$([\d.,]+)\s+\$([\d.,]+)/);
  if (divTotalMatch) result.dividendsYTD = parseNumber(divTotalMatch[2]);

  // Realized gains
  const gainMatch = text.match(/Net Gain\/Loss\s+\$([\d.,]+)\s+\$([\d.,]+)/);
  if (gainMatch) result.realizedGainLoss = parseNumber(gainMatch[2]);

  // Ending value
  const endMatch = text.match(/Ending.*Account Value\s+\$([\d.,]+)/);
  if (endMatch) result.endingValue = parseNumber(endMatch[1]);

  // MSFT holdings quantity
  const msftMatch = text.match(/MICROSOFT CORP \(MSFT\)\s+\$[\d.,]+\s+([\d.]+)/);
  if (msftMatch) result.holdingsQuantity = parseFloat(msftMatch[1]);

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
    participantId: ''
  };

  // "YOU SOLD 2 AT 431.5000"
  const soldMatch = text.match(/YOU SOLD\s+([\d.]+)\s+AT\s+([\d.]+)/i);
  if (soldMatch) {
    result.shares = parseFloat(soldMatch[1]);
    result.pricePerShare = parseFloat(soldMatch[2]);
  }

  // Symbol
  const symbolMatch = text.match(/SYMBOL:\s*(\w+)/);
  if (symbolMatch) result.symbol = symbolMatch[1];

  // Company name (line after SYMBOL)
  const companyMatch = text.match(/SYMBOL:\s*\w+\s*\n(.+)/);
  if (companyMatch) result.company = companyMatch[1].trim();

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

  // Ref number
  const refMatch = text.match(/REF #\s*([\w-]+)/);
  if (refMatch) result.refNumber = refMatch[1];

  // Participant
  const partMatch = text.match(/PARTICIPANT.*?\n\s*(I\d+)/);
  if (partMatch) result.participantId = partMatch[1];

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
    const headerCols = lines[headerIdx].split(/\s{2,}|\t/).map(c => c.trim().toLowerCase().replace(/\s+/g, '_'));
    for (let i = headerIdx + 1; i < lines.length; i++) {
      const line = lines[i];
      if (!line || /^\s*$/.test(line) || /^total|^sum/i.test(line)) continue;

      const dataCols = line.split(/\s{2,}|\t/);
      if (dataCols.length < 2) continue;

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
      if (!isNaN(wh)) {
        row.stock_withholding = wh;
        if (wh > 0) {
          result.totalWithholding += wh;
          result.rows.push(row);
        }
      }
    }
  }

  // Fallback: pattern match for Microsoft payroll format (OCR)
  if (result.rows.length === 0) {
    for (const line of lines) {
      const m = line.match(/(\d{1,2}-\w{3}-\d{4})\s+\d+\s+\w+\s+[\w ]+\s+\d+\s+(\w+)\s+\w+\s+(\d+)\s+(\d+)/);
      if (m) {
        const wh = parseInt(m[4], 10);
        if (wh > 0) {
          result.rows.push({
            datastat: m[1],
            stock_award_bik: parseInt(m[3], 10),
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
      const m = line.match(/(\d{1,2}-\w{3}-\d{4})\s+\d+\s+\w+\s+[\w ]+\s+\d+\s+(\w+)\s+\w+\s+(\d+)\s+(\d+)/);
      if (m) {
        allRows.push({
          datastat: m[1], espp_gain_bik: '0',
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
      stdio: 'ignore'
    });
    child.unref();
    process.exit(0);
  }, 500);
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
});
