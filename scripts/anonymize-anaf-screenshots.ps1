#requires -version 5.1
<#
.SYNOPSIS
  Anonymize DUF portal screenshots into assets safe for the public repo.

.DESCRIPTION
  Takes the local screenshots in D:\temp\anaf-screenshots\ (not committed —
  they contain real PII) and produces redacted versions in
  public/assets/screenshots/duf-*.png (committed — safe to share).

  The redaction is done by painting white rectangles over PII-bearing
  bounding boxes and overlaying placeholder text. Coordinates are
  hardcoded per source image; if ANAF redesigns the portal the source
  screenshots will need to be re-taken and the rectangles re-tuned.

  PII tokens redacted across all 4 images:
    * Authorization number + date (e.g. "2428 / 09.02.2017")
    * Address ("BRASOV, STR FAGURULUI NR 77")
    * Per-broker / per-bank CUIs (6151100, 10318789, 24270192, 6838953)
    * Real RON amounts that, combined with the donor's other public data,
      could deanonymize the document (61000, 27076, 513258, 28132)

.NOTES
  Script is one-shot tooling, not used at runtime. The redacted output is
  what gets committed.
#>

$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing

$SrcDir = 'D:\temp\anaf-screenshots'
$DstDir = 'D:\src\_DevByZen_\D212TaxHelper\public\assets\screenshots'
New-Item -ItemType Directory -Force -Path $DstDir | Out-Null

# Helper: open image, mutate via callback, save as output.
function Redact-Image {
  param(
    [string]$Src,
    [string]$Dst,
    [scriptblock]$DrawCallback
  )
  $img = [System.Drawing.Image]::FromFile($Src)
  $bmp = New-Object System.Drawing.Bitmap $img
  $img.Dispose()
  $g = [System.Drawing.Graphics]::FromImage($bmp)
  $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
  $g.TextRenderingHint = [System.Drawing.Text.TextRenderingHint]::AntiAlias
  & $DrawCallback $g $bmp.Width $bmp.Height
  $g.Flush()
  $g.Dispose()
  $bmp.Save($Dst, [System.Drawing.Imaging.ImageFormat]::Png)
  $bmp.Dispose()
  "Wrote $Dst"
}

# Small fonts cache (reused across drawings).
$FontMono = New-Object System.Drawing.Font 'Consolas', 14, ([System.Drawing.FontStyle]::Regular)
$FontMonoSmall = New-Object System.Drawing.Font 'Consolas', 12, ([System.Drawing.FontStyle]::Regular)
$BrushWhite = [System.Drawing.Brushes]::White
$BrushGray = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(110, 110, 110))
$BrushBlackBg = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(40, 40, 40))

function Paint-Box {
  param($g, $x, $y, $w, $h, $placeholder = '[anonimizat]', $bg = 'white')
  if ($bg -eq 'white') {
    $g.FillRectangle($BrushWhite, $x, $y, $w, $h)
    $textBrush = $BrushGray
  } else {
    $g.FillRectangle($BrushBlackBg, $x, $y, $w, $h)
    $textBrush = $BrushWhite
  }
  $font = if ($h -le 18) { $FontMonoSmall } else { $FontMono }
  $size = $g.MeasureString($placeholder, $font)
  $tx = $x + [Math]::Max(4, ($w - $size.Width) / 2)
  $ty = $y + [Math]::Max(0, ($h - $size.Height) / 2)
  $g.DrawString($placeholder, $font, $textBrush, $tx, $ty)
}

# ---------------- Screenshot 1: 115343 — Preluare/modificare date ----------------
# Source: 1869 x 995. PII boxes (hand-tuned, second pass):
#   Top header authorization is between "Sistem Real - Nr./data autorizatie: " and the
#   ending punctuation. It spans approximately x=1102..1465, y=358..400. The string
#   "2428 / 09.02.2017" is about 200 px wide; widen the cover to catch the trailing
#   "017" that was peeking out.
#   Cell values inside the table are right-aligned, but the visible text is left-aligned
#   at the cell padding (x ≈ 805..985, y rows ≈ 510, 638, 668, 698).
Redact-Image -Src "$SrcDir\Screenshot 2026-05-19 115343.png" -Dst "$DstDir\duf-step1-prelaure-modificare.png" -DrawCallback {
  param($g, $w, $h)
  Paint-Box $g 1100 360 365 38 '[autorizatie / data]'
  Paint-Box $g 802 510 200 28 '[nr / data]'
  Paint-Box $g 802 639 290 28 '[adresa sediu]'
  Paint-Box $g 802 668 130 28 '[suma]'
  Paint-Box $g 802 698 130 28 '[suma]'
}

# ---------------- Screenshot 2: 115401 — Situatie centralizatoare ----------------
# Source: 1319 x 1182. PII (second pass, tightened boxes):
#   "Autorizatie: 2428 / 09.02.2017" — start after "Autorizatie:" label ends.
#   Layout: "Autorizație: " takes ~95 px, then "2428 / 09.02.2017" runs to ~290 px.
#   Banner "Total: 513258" sits inline with the sectioning header. The "Total:" label
#   is at x ≈ 130, the number runs x ≈ 175..235.
#   Right-column "Total: 513258" appears at ~x=1148..1240.
#   The D205 detail line block: y=956..1027, x=210..1245.
Redact-Image -Src "$SrcDir\Screenshot 2026-05-19 115401.png" -Dst "$DstDir\duf-step2-centralizator.png" -DrawCallback {
  param($g, $w, $h)
  # Cover only "2428 / 09.02.2017", keep the "Autorizație:" label visible.
  Paint-Box $g 170 408 145 28 '[nr]'
  # D205 multi-line detail
  Paint-Box $g 205 956 1045 72 '[detalii D205 — CUI + nume + sume per platitor — anonimizat]'
  # Top banner "Total: 513258" — cover the number, leave "Total:" label.
  Paint-Box $g 168 808 85 24 '[suma]'
  # Section "6 - Venit..." header right: "Elemente: 1 · Total: 513258"
  Paint-Box $g 1148 854 110 24 '[suma]'
  # Right-column under "Venit (baza calcul CASS)" header — cover value rows only.
  Paint-Box $g 1170 990 85 50 '[suma]'
}

# ---------------- Screenshot 3: 115431 — Sub-section cap14 (no PII really) -------
# Source: 1276 x 702. Values are "US", "2012", "1" — public codes, not PII.
# But the explanatory orange text contains "2024" + transferul titlurilor etc.,
# which is generic. Nothing to redact — copy as-is.
Redact-Image -Src "$SrcDir\Screenshot 2026-05-19 115431.png" -Dst "$DstDir\duf-step3-cap14-detail.png" -DrawCallback {
  param($g, $w, $h)
  # No redactions — image is generic.
}

# ---------------- Screenshot 4: 115436 — Sursa informatiilor modal ----------------
# Source: 1303 x 374. PII: "28132" (real net amount).
# The "Venit net" column header starts at ~x=885, the value "28132" sits at ~x=890..955,
# y ≈ 248..278. Earlier coordinates were aimed too far right (overlapping with the
# "Pierdere precedentă" column instead).
Redact-Image -Src "$SrcDir\Screenshot 2026-05-19 115436.png" -Dst "$DstDir\duf-step4-sursa-modal.png" -DrawCallback {
  param($g, $w, $h)
  # The "Venit net" cell spans approximately y=246..305 (header + value + bottom).
  # Cover the whole cell to make sure the digits are fully gone.
  Paint-Box $g 880 245 100 60 '[suma]'
}

$FontMono.Dispose(); $FontMonoSmall.Dispose(); $BrushGray.Dispose(); $BrushBlackBg.Dispose()
Get-ChildItem $DstDir | Format-Table Name, Length
