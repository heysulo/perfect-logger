#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const esmDir = path.resolve(__dirname, '../dist/esm');

if (!fs.existsSync(esmDir)) {
  console.error(`[fix-esm] Target ESM directory not found: ${esmDir}`);
  process.exit(1);
}

// 1. Ensure dist/esm/package.json exists with {"type": "module"}
const packageJsonPath = path.join(esmDir, 'package.json');
fs.writeFileSync(
  packageJsonPath,
  JSON.stringify({ type: 'module' }, null, 2) + '\n',
  'utf8'
);
console.log(`[fix-esm] Created ${packageJsonPath}`);

// 2. Rewrite relative imports/exports to include .js extensions
function rewriteSpecifier(specifier, fileDir) {
  // Only handle relative specifiers
  if (!specifier.startsWith('./') && !specifier.startsWith('../')) {
    return specifier;
  }
  // If already has an extension, leave as is
  if (path.extname(specifier)) {
    return specifier;
  }

  const targetPath = path.resolve(fileDir, specifier);
  if (fs.existsSync(targetPath) && fs.statSync(targetPath).isDirectory()) {
    return `${specifier}/index.js`;
  }
  return `${specifier}.js`;
}

function processFile(filePath) {
  const fileDir = path.dirname(filePath);
  let content = fs.readFileSync(filePath, 'utf8');

  // Regex for static import/export statements:
  // e.g., import ... from './foo'; export ... from './foo'; import './foo'; export * from './foo';
  const staticImportExportRegex =
    /((?:import|export)\s+[\s\S]*?from\s+['"]|import\s+['"])((\.{1,2}\/)[^'"]+?)(['"])/g;

  content = content.replace(
    staticImportExportRegex,
    (match, prefix, specifier, _rel, suffix) => {
      const updated = rewriteSpecifier(specifier, fileDir);
      return `${prefix}${updated}${suffix}`;
    }
  );

  // Regex for dynamic imports: import('./foo')
  const dynamicImportRegex =
    /(import\s*\(\s*['"])((\.{1,2}\/)[^'"]+?)(['"]\s*\))/g;

  content = content.replace(
    dynamicImportRegex,
    (match, prefix, specifier, _rel, suffix) => {
      const updated = rewriteSpecifier(specifier, fileDir);
      return `${prefix}${updated}${suffix}`;
    }
  );

  fs.writeFileSync(filePath, content, 'utf8');
}

function walk(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walk(fullPath);
    } else if (entry.isFile() && entry.name.endsWith('.js')) {
      processFile(fullPath);
    }
  }
}

walk(esmDir);
console.log('[fix-esm] Completed rewriting relative imports in dist/esm');

// 3. Self-Verification: verify that all relative imports in dist/esm point to existing files
const { execSync } = require('child_process');
let verificationErrors = 0;

function verifyFileImports(filePath) {
  const fileDir = path.dirname(filePath);
  const content = fs.readFileSync(filePath, 'utf8');
  const importMatches = content.matchAll(/(?:from|import)\s+['"](\.\.?\/[^'"]+)['"]/g);
  for (const match of importMatches) {
    const specifier = match[1];
    const resolvedPath = path.resolve(fileDir, specifier);
    if (!fs.existsSync(resolvedPath)) {
      console.error(`[fix-esm] ERROR: Broken import in ${path.relative(process.cwd(), filePath)}: "${specifier}" -> ${resolvedPath} not found`);
      verificationErrors++;
    }
  }
}

function verifyWalk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) verifyWalk(fullPath);
    else if (entry.isFile() && entry.name.endsWith('.js')) verifyFileImports(fullPath);
  }
}

verifyWalk(esmDir);

if (verificationErrors > 0) {
  console.error(`[fix-esm] Build failed: ${verificationErrors} broken import(s) detected in ESM build.`);
  process.exit(1);
}

// 4. Smoke test: load dist/esm/index.js using Node native ESM and dist/index.js using CommonJS
try {
  execSync(
    'node --input-type=module -e "import(\'./dist/esm/index.js\').then(m => { if (!m.LogManager || !m.Logger) throw new Error(\'Missing core ESM exports\'); })"',
    { stdio: 'pipe' }
  );
  execSync(
    'node -e "const m = require(\'./dist/index.js\'); if (!m.LogManager || !m.Logger) throw new Error(\'Missing core CJS exports\');"',
    { stdio: 'pipe' }
  );
  console.log('[fix-esm] Verified both ESM and CJS builds import cleanly in Node.js');
} catch (err) {
  console.error('[fix-esm] Verification failed: Node could not import dist bundle');
  if (err.stderr) console.error(err.stderr.toString());
  process.exit(1);
}
