import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import ts from 'typescript';

const appRoot = fileURLToPath(new URL('..', import.meta.url));
const sourceRoot = path.join(appRoot, 'src');
const failures = [];
// Matches .prettierrc.json printWidth — longer class lists must be split into
// grouped cn() arguments (one concern per line).
const maxClassString = 100;
const cssomMethods = new Set(['addRule', 'insertRule', 'removeProperty', 'replaceSync', 'setProperty']);
const allowedCssImports = new Set([
  './styles/tailwind.css',
  '@fontsource/ibm-plex-mono/400.css',
  '@fontsource/ibm-plex-mono/500.css',
  '@fontsource/ibm-plex-sans/400.css',
  '@fontsource/ibm-plex-sans/500.css',
  '@fontsource/ibm-plex-sans/600.css',
]);

async function walk(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = await Promise.all(
    entries.map((entry) => {
      const target = path.join(directory, entry.name);
      return entry.isDirectory() ? walk(target) : target;
    }),
  );
  return files.flat();
}

function relative(file) {
  return path.relative(appRoot, file).replaceAll('\\', '/');
}

function propertyName(node) {
  if (ts.isIdentifier(node) || ts.isStringLiteral(node)) return node.text;
  return null;
}

function verifySource(file, source) {
  const scriptKind = file.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS;
  const tree = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, scriptKind);
  const reportedLongStrings = new Set();

  function checkClassStringLength(root) {
    const collect = (child) => {
      if (
        (ts.isStringLiteral(child) || ts.isNoSubstitutionTemplateLiteral(child)) &&
        child.text.length > maxClassString &&
        !reportedLongStrings.has(child.getStart())
      ) {
        reportedLongStrings.add(child.getStart());
        failures.push(
          `${relative(file)}:${tree.getLineAndCharacterOfPosition(child.getStart()).line + 1} class string over ${maxClassString} chars — split into grouped cn() lines`,
        );
      }
      ts.forEachChild(child, collect);
    };
    ts.forEachChild(root, collect);
  }

  function visit(node) {
    if (
      (ts.isJsxAttribute(node) && node.name.getText(tree) === 'className') ||
      (ts.isCallExpression(node) && ts.isIdentifier(node.expression) && node.expression.text === 'cn')
    ) {
      checkClassStringLength(node);
    }

    if (ts.isImportDeclaration(node) && ts.isStringLiteral(node.moduleSpecifier)) {
      const target = node.moduleSpecifier.text;
      if (target.endsWith('.css') && !allowedCssImports.has(target)) {
        failures.push(`${relative(file)}:${tree.getLineAndCharacterOfPosition(node.getStart()).line + 1} imports raw CSS from ${target}`);
      }
    }

    if (
      ts.isCallExpression(node) &&
      node.expression.kind === ts.SyntaxKind.ImportKeyword &&
      node.arguments[0] &&
      ts.isStringLiteral(node.arguments[0]) &&
      node.arguments[0].text.endsWith('.css')
    ) {
      failures.push(`${relative(file)}:${tree.getLineAndCharacterOfPosition(node.getStart()).line + 1} dynamically imports raw CSS`);
    }

    const usesStyleMember =
      ts.isPropertyAccessExpression(node) &&
      ts.isPropertyAccessExpression(node.expression) &&
      node.expression.name.text === 'style';
    const passesOrAssignsStyleObject =
      ts.isPropertyAccessExpression(node) &&
      node.name.text === 'style' &&
      ((ts.isCallExpression(node.parent) && node.parent.arguments.includes(node)) ||
        (ts.isBinaryExpression(node.parent) &&
          node.parent.left === node &&
          node.parent.operatorToken.kind === ts.SyntaxKind.EqualsToken));
    if (usesStyleMember || passesOrAssignsStyleObject) {
      failures.push(`${relative(file)}:${tree.getLineAndCharacterOfPosition(node.getStart()).line + 1} uses the DOM style API directly`);
    }

    if (ts.isPropertyAccessExpression(node) && node.name.text === 'cssText') {
      failures.push(`${relative(file)}:${tree.getLineAndCharacterOfPosition(node.getStart()).line + 1} uses cssText directly`);
    }

    if (ts.isCallExpression(node) && ts.isPropertyAccessExpression(node.expression)) {
      const method = node.expression.name.text;
      const setsStyleAttribute =
        method === 'setAttribute' &&
        node.arguments[0] &&
        ts.isStringLiteral(node.arguments[0]) &&
        node.arguments[0].text.toLowerCase() === 'style';
      if (cssomMethods.has(method) || setsStyleAttribute) {
        failures.push(`${relative(file)}:${tree.getLineAndCharacterOfPosition(node.getStart()).line + 1} uses raw CSS through ${method}()`);
      }
    }

    if (ts.isTaggedTemplateExpression(node)) {
      const tag = node.tag.getText(tree);
      if (tag === 'css' || tag.startsWith('styled.') || tag === 'styled') {
        failures.push(`${relative(file)}:${tree.getLineAndCharacterOfPosition(node.getStart()).line + 1} uses a CSS-in-JS template`);
      }
    }

    if (
      (ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) &&
      node.tagName.getText(tree).toLowerCase() === 'style'
    ) {
      failures.push(`${relative(file)}:${tree.getLineAndCharacterOfPosition(node.getStart()).line + 1} renders a raw style element`);
    }

    if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) {
      for (const token of node.text.split(/\s+/u)) {
        if (!token.includes('[')) continue;
        // data-attribute variants select on state; arbitrary values (h-[34px])
        // and arbitrary properties ([transform:…]) belong in the theme instead.
        const stripped = token.replaceAll(/data-\[[^\]]*\]/gu, '');
        if (/-\[[^\]]*\]/u.test(stripped) || /^\[[^\]]+:/u.test(stripped)) {
          failures.push(
            `${relative(file)}:${tree.getLineAndCharacterOfPosition(node.getStart()).line + 1} uses an arbitrary Tailwind value: ${token}`,
          );
          break;
        }
      }
    }

    if (ts.isJsxAttribute(node) && node.name.getText(tree) === 'style') {
      let objectCount = 0;
      const inspectStyle = (child) => {
        if (ts.isObjectLiteralExpression(child)) {
          objectCount += 1;
          for (const property of child.properties) {
            if (!ts.isPropertyAssignment(property)) {
              failures.push(`${relative(file)}:${tree.getLineAndCharacterOfPosition(property.getStart()).line + 1} uses a non-explicit JSX style property`);
              continue;
            }
            const name = propertyName(property.name);
            if (!name?.startsWith('--')) {
              failures.push(`${relative(file)}:${tree.getLineAndCharacterOfPosition(property.getStart()).line + 1} uses raw JSX style property ${name ?? property.name.getText(tree)}`);
            }
          }
        }
        ts.forEachChild(child, inspectStyle);
      };
      if (node.initializer) inspectStyle(node.initializer);
      if (objectCount === 0) {
        failures.push(`${relative(file)}:${tree.getLineAndCharacterOfPosition(node.getStart()).line + 1} has a style prop without explicit runtime variables`);
      }
    }

    ts.forEachChild(node, visit);
  }

  visit(tree);
}

const files = await walk(sourceRoot);
const stylesheets = files.filter((file) => /\.(?:css|less|sass|scss|styl)$/u.test(file));
const expectedStylesheet = path.join(sourceRoot, 'styles', 'tailwind.css');
// debug.scss is a dev-only helper (dd* dotted-outline classes) that sits
// deliberately outside the Tailwind boundary; nothing in the app may depend on it.
const debugStylesheet = path.join(sourceRoot, 'styles', 'debug.scss');
const allowedStylesheets = new Set([expectedStylesheet, debugStylesheet]);
const unexpected = stylesheets.filter((file) => !allowedStylesheets.has(file));

if (unexpected.length > 0 || !stylesheets.includes(expectedStylesheet)) {
  failures.push(
    `expected only src/styles/tailwind.css (+ optional src/styles/debug.scss); found ${stylesheets.map(relative).join(', ') || 'none'}`,
  );
}

if (stylesheets.includes(expectedStylesheet)) {
  const css = await readFile(expectedStylesheet, 'utf8');
  for (const [index, line] of css.split(/\r?\n/u).entries()) {
    const value = line.trim();
    if (!value || value === '}' || value.startsWith('@') || value.startsWith('--')) continue;
    if (value.startsWith('/*') && value.endsWith('*/')) continue;
    failures.push(`${relative(expectedStylesheet)}:${index + 1} contains raw CSS: ${value}`);
  }
}

for (const file of files.filter((candidate) => /\.tsx?$/u.test(candidate) && !candidate.includes('.test.'))) {
  verifySource(file, await readFile(file, 'utf8'));
}

const indexHtml = await readFile(path.join(appRoot, 'index.html'), 'utf8');
for (const pattern of [/\sstyle\s*=/iu, /<style(?:\s|>)/iu]) {
  if (pattern.test(indexHtml)) failures.push(`index.html contains raw CSS matching ${pattern}`);
}

if (failures.length > 0) {
  console.error(failures.join('\n'));
  process.exitCode = 1;
} else {
  console.log('Tailwind boundary verified: no authored selectors, raw style declarations, or arbitrary values.');
}
