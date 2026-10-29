// Smoke tests: the page loads its assets, every script parses, and no secrets are committed.
const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const root = path.join(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const localRefs = [...html.matchAll(/(?:src|href)="([^"#?]+)"/g)]
  .map((m) => m[1])
  .filter((u) => !/^(?:[a-z]+:|\/\/|\.\/?$)/i.test(u));

function walk(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (['node_modules', '.git', 'test'].includes(e.name)) continue;
    const p = path.join(dir, e.name);
    e.isDirectory() ? walk(p, out) : out.push(p);
  }
  return out;
}
const files = walk(root);
const scripts = files.filter((f) => f.endsWith('.js'));

test('index.html is a complete HTML document', () => {
  assert.match(html, /<!DOCTYPE html>/i);
  assert.match(html, /<meta[^>]+name="viewport"/i);
  assert.match(html, /<title>[^<]+<\/title>/i);
});

test('every local asset referenced by index.html exists', () => {
  assert.ok(localRefs.length > 0, 'expected at least one local reference');
  const missing = localRefs.filter((u) => !fs.existsSync(path.join(root, decodeURI(u))));
  assert.deepStrictEqual(missing, []);
});

test('every JavaScript file has valid syntax', () => {
  assert.ok(scripts.length > 0);
  for (const f of scripts) execFileSync(process.execPath, ['--check', f]);
});

test('no API keys or tokens are committed', () => {
  const patterns = [/sk-[A-Za-z0-9]{32,}/, /gsk_[A-Za-z0-9]{40,}/, /AIza[0-9A-Za-z_-]{35}/, /ghp_[A-Za-z0-9]{36}/, /[MN][A-Za-z\d]{23}\.[\w-]{6}\.[\w-]{27}/];
  for (const f of files.filter((x) => /\.(js|html|css|json|md)$/.test(x))) {
    const src = fs.readFileSync(f, 'utf8');
    for (const re of patterns) assert.doesNotMatch(src, re, `possible secret in ${path.relative(root, f)}`);
  }
});
