const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

// Read the code from docs/site-version.js
const codePath = path.join(__dirname, '..', 'docs', 'site-version.js');
const code = fs.readFileSync(codePath, 'utf8');

// Extract localPage function body
const localPageRegex = /function localPage\(url\)\{(.*?)\}/;
const match = code.match(localPageRegex);

if (!match) {
  throw new Error("Could not find localPage function in site-version.js");
}

const localPageBody = match[1];

// Compile a testable version of localPage by injecting location
const testableLocalPage = new Function('url', 'location', `${localPageBody}`);

test('localPage function tests', async (t) => {

  // Set up mock location to match typical execution environment
  const mockLocation = {
    origin: 'http://localhost:8000',
    href: 'http://localhost:8000/docs/index.html'
  };

  await t.test('returns true for same origin and .html extension in same directory', () => {
    const url = new URL('http://localhost:8000/docs/about.html');
    assert.strictEqual(testableLocalPage(url, mockLocation), true);
  });

  await t.test('returns true for same origin and uppercase .HTML extension', () => {
    const url = new URL('http://localhost:8000/docs/ABOUT.HTML');
    assert.strictEqual(testableLocalPage(url, mockLocation), true);
  });

  await t.test('returns true for same origin without extension (directory path)', () => {
    const url = new URL('http://localhost:8000/docs/');
    assert.strictEqual(testableLocalPage(url, mockLocation), true);
  });

  await t.test('returns false for different origin', () => {
    const url = new URL('http://example.com/docs/about.html');
    assert.strictEqual(testableLocalPage(url, mockLocation), false);
  });

  await t.test('returns false for path outside current directory', () => {
    const url = new URL('http://localhost:8000/other/about.html');
    assert.strictEqual(testableLocalPage(url, mockLocation), false);
  });

  await t.test('returns false for non-html extension (e.g. .js)', () => {
    const url = new URL('http://localhost:8000/docs/script.js');
    assert.strictEqual(testableLocalPage(url, mockLocation), false);
  });

  await t.test('returns false for non-html extension (e.g. .css)', () => {
    const url = new URL('http://localhost:8000/docs/style.css');
    assert.strictEqual(testableLocalPage(url, mockLocation), false);
  });

  await t.test('handles URL with query parameters properly (html)', () => {
    const url = new URL('http://localhost:8000/docs/about.html?v=123');
    assert.strictEqual(testableLocalPage(url, mockLocation), true);
  });

  await t.test('handles URL with hash fragment properly (html)', () => {
    const url = new URL('http://localhost:8000/docs/about.html#section');
    assert.strictEqual(testableLocalPage(url, mockLocation), true);
  });

  await t.test('handles root path properly', () => {
    const rootLocation = {
      origin: 'https://example.com',
      href: 'https://example.com/'
    };
    const url = new URL('https://example.com/page.html');
    assert.strictEqual(testableLocalPage(url, rootLocation), true);
  });

  await t.test('returns false for partial origin match', () => {
    const url = new URL('http://localhostevil.com/docs/about.html');
    assert.strictEqual(testableLocalPage(url, mockLocation), false);
  });

});
