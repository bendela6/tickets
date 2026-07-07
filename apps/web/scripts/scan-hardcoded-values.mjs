// Zero-dependency style-context hardcoded-color scan.
//
// Flags style-context hex and rgb()/hsl() — Tailwind arbitrary values
// (any `[...#hex...]` or `[...rgb(/hsl(...]` bracketed utility, e.g.
// `bg-[#hex]`, `text-[color:#hex]`, `[--brand:#hex]`), hex/rgb()/hsl()
// inside inline `style=`/`style={{...}}`, and color declarations in
// hand-written `.css`. It intentionally does NOT flag data constants
// (e.g. a persisted-API-hex PALETTE table) or hex inside `*.test.*`
// fixtures/assertions — those aren't styling.
import { readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const srcDir = path.join(__dirname, '..', 'src');

const EXCLUDE_RES = [
  /\.test\./,
  /(^|\/)src\/styles\/tokens\//,
  /(^|\/)src\/styles\/instrument\.css$/,
];

function toPosix(p) {
  return p.split(path.sep).join('/');
}

function isExcluded(relPath) {
  const normalized = toPosix(relPath);
  return EXCLUDE_RES.some((re) => re.test(normalized));
}

function walk(dir, files) {
  for (const entry of readdirSync(dir)) {
    if (entry === 'node_modules') continue;
    const full = path.join(dir, entry);
    const stat = statSync(full);
    if (stat.isDirectory()) {
      walk(full, files);
    } else if (/\.(ts|tsx|css)$/.test(entry)) {
      files.push(full);
    }
  }
  return files;
}

// Replace `//` and `/* */` comments with same-length whitespace, respecting
// string/template literals so a hex reworded inside a comment (or inside a
// string that merely contains "//") never trips the scan. Output keeps the
// same length and newlines as the input, so line numbers stay accurate.
function stripComments(text) {
  let out = '';
  let i = 0;
  let mode = 'code'; // 'code' | 'line' | 'block' | '"' | "'" | '`'
  while (i < text.length) {
    const c = text[i];
    const c2 = text[i + 1];
    if (mode === 'line') {
      out += c === '\n' ? '\n' : ' ';
      if (c === '\n') mode = 'code';
      i++;
      continue;
    }
    if (mode === 'block') {
      if (c === '*' && c2 === '/') {
        out += '  ';
        i += 2;
        mode = 'code';
        continue;
      }
      out += c === '\n' ? '\n' : ' ';
      i++;
      continue;
    }
    if (mode === '"' || mode === "'" || mode === '`') {
      out += c;
      if (c === '\\' && i + 1 < text.length) {
        out += text[i + 1];
        i += 2;
        continue;
      }
      if (c === mode) mode = 'code';
      i++;
      continue;
    }
    // mode === 'code'
    if (c === '/' && c2 === '/') {
      mode = 'line';
      out += '  ';
      i += 2;
      continue;
    }
    if (c === '/' && c2 === '*') {
      mode = 'block';
      out += '  ';
      i += 2;
      continue;
    }
    if (c === '"' || c === "'" || c === '`') {
      mode = c;
      out += c;
      i++;
      continue;
    }
    out += c;
    i++;
  }
  return out;
}

// Find `[start, end)` spans covering `style="..."` and `style={{ ... }}`
// so plain hex found there can be told apart from hex in data constants.
function findStyleRegions(text) {
  const regions = [];
  const re = /style\s*=\s*/g;
  let m;
  while ((m = re.exec(text))) {
    let idx = re.lastIndex;
    while (idx < text.length && /\s/.test(text[idx])) idx++;
    const startChar = text[idx];
    if (startChar === '"' || startChar === "'") {
      const quote = startChar;
      let end = idx + 1;
      while (end < text.length && text[end] !== quote) {
        if (text[end] === '\\') end++;
        end++;
      }
      end = Math.min(end + 1, text.length);
      regions.push([idx, end]);
      re.lastIndex = end;
    } else if (startChar === '{') {
      let depth = 0;
      let end = idx;
      for (; end < text.length; end++) {
        if (text[end] === '{') depth++;
        else if (text[end] === '}') {
          depth--;
          if (depth === 0) {
            end++;
            break;
          }
        }
      }
      regions.push([idx, end]);
      re.lastIndex = end;
    }
  }
  return regions;
}

function lineAt(rawText, index) {
  const lineStart = rawText.lastIndexOf('\n', index - 1) + 1;
  let lineEnd = rawText.indexOf('\n', index);
  if (lineEnd === -1) lineEnd = rawText.length;
  let line = 1;
  for (let i = 0; i < lineStart; i++) {
    if (rawText[i] === '\n') line++;
  }
  return { line, text: rawText.slice(lineStart, lineEnd).trim() };
}

// Returns a list of `{ index }` hit positions for a .ts/.tsx file: Tailwind
// arbitrary color values anywhere, plus plain hex/rgb()/hsl() confined to
// style regions.
function scanTsLike(strippedText) {
  const hitIndexes = new Set();

  // Any hex literal inside a bracketed Tailwind arbitrary value — not just
  // `[#hex]` but also `[color:#hex]`, `[--brand:#hex]`, etc. Bounded to a
  // single line (`[^\]\n]*`, not `[^\]]*`): Tailwind arbitrary-value
  // brackets are always written on one line, so this stays a tight match
  // on real bracket contents instead of running on past the `[` of an
  // unrelated multi-line array/object literal (e.g. a PALETTE data table)
  // looking for the next `]`.
  const bracketRe = /\[[^\]\n]*#[0-9a-fA-F]{3,8}/g;
  let m;
  while ((m = bracketRe.exec(strippedText))) {
    hitIndexes.add(m.index);
  }

  // Any rgb()/hsl() call inside a bracketed Tailwind arbitrary value.
  const bracketFuncRe = /\[[^\]\n]*(rgb|hsl)a?\(/g;
  while ((m = bracketFuncRe.exec(strippedText))) {
    hitIndexes.add(m.index);
  }

  const styleRegions = findStyleRegions(strippedText);

  const hexRe = /#[0-9a-fA-F]{3,8}/g;
  while ((m = hexRe.exec(strippedText))) {
    const idx = m.index;
    if (strippedText[idx - 1] === '[' && strippedText[idx + m[0].length] === ']') continue; // already a bracket hit
    const inStyle = styleRegions.some(([s, e]) => idx >= s && idx < e);
    if (inStyle) hitIndexes.add(idx);
  }

  const funcRe = /(rgb|hsl)a?\(/g;
  while ((m = funcRe.exec(strippedText))) {
    const idx = m.index;
    const inStyle = styleRegions.some(([s, e]) => idx >= s && idx < e);
    if (inStyle) hitIndexes.add(idx);
  }

  return [...hitIndexes];
}

// Returns hit positions for a .css file: hex color literals plus rgb()/hsl()
// function calls, which in hand-written CSS only ever occur in declaration
// values (never in selectors).
function scanCss(strippedText) {
  const hitIndexes = new Set();
  const hexRe = /#[0-9a-fA-F]{3,8}/g;
  let m;
  while ((m = hexRe.exec(strippedText))) hitIndexes.add(m.index);
  const funcRe = /(rgb|hsl)\(/g;
  while ((m = funcRe.exec(strippedText))) hitIndexes.add(m.index);
  return [...hitIndexes];
}

function scanFile(file) {
  const raw = readFileSync(file, 'utf8');
  const stripped = stripComments(raw);
  const indexes = file.endsWith('.css') ? scanCss(stripped) : scanTsLike(stripped);
  return indexes
    .sort((a, b) => a - b)
    .map((idx) => lineAt(raw, idx));
}

function main() {
  const files = walk(srcDir, []).filter((f) => !isExcluded(path.relative(process.cwd(), f)));

  if (files.length === 0) {
    console.error('error: scanned zero files — check srcDir/EXCLUDE_RES/walk() before trusting this gate');
    process.exit(1);
  }

  let hitCount = 0;
  for (const file of files) {
    const relPath = toPosix(path.relative(process.cwd(), file));
    for (const hit of scanFile(file)) {
      console.log(`${relPath}:${hit.line}: ${hit.text}`);
      hitCount++;
    }
  }

  if (hitCount > 0) {
    process.exit(1);
  }
  console.log(`ok: no style-context hardcoded values (${files.length} files scanned)`);
}

main();
