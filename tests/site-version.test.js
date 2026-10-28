const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const vm = require('vm');
const path = require('path');

const codePath = path.join(__dirname, '../docs/site-version.js');
const code = fs.readFileSync(codePath, 'utf8');

function setupContext(mockLocation, mockFetch, initialVersion = 'abc123def456') {
    const context = {
        document: {
            documentElement: {
                dataset: {
                    siteVersion: initialVersion
                }
            },
            addEventListener: () => {}
        },
        window: {
            addEventListener: (event, handler) => {
                if (event === 'pageshow') {
                    context.check = handler;
                }
            }
        },
        location: mockLocation,
        URL: URL,
        fetch: mockFetch,
        Date: {
            now: () => 1234567890
        }
    };
    vm.createContext(context);
    vm.runInContext(code, context);
    return context;
}

test('site-version check function', async (t) => {
    await t.test('updates location on new version', async () => {
        let replaceCalledWith = null;
        const mockLocation = {
            href: 'http://localhost/page.html',
            origin: 'http://localhost',
            pathname: '/page.html',
            replace: (url) => { replaceCalledWith = url; }
        };

        const mockFetch = async (url, options) => {
            assert.strictEqual(url, './site-release.json?check=1234567890');
            assert.strictEqual(options.cache, 'no-store');
            return {
                ok: true,
                json: async () => ({ version: '111122223333' })
            };
        };

        const ctx = setupContext(mockLocation, mockFetch);
        await ctx.check();

        assert.strictEqual(replaceCalledWith, 'http://localhost/page.html?v=111122223333');
    });

    await t.test('does not update if fetch fails (response.ok is false)', async () => {
        let replaceCalledWith = null;
        const mockLocation = {
            href: 'http://localhost/page.html',
            replace: (url) => { replaceCalledWith = url; }
        };
        const mockFetch = async () => ({ ok: false });
        const ctx = setupContext(mockLocation, mockFetch);
        await ctx.check();
        assert.strictEqual(replaceCalledWith, null);
    });

    await t.test('does not update if fetch throws an error', async () => {
        let replaceCalledWith = null;
        const mockLocation = {
            href: 'http://localhost/page.html',
            replace: (url) => { replaceCalledWith = url; }
        };
        const mockFetch = async () => { throw new Error('Network error'); };
        const ctx = setupContext(mockLocation, mockFetch);
        await ctx.check();
        assert.strictEqual(replaceCalledWith, null);
    });

    await t.test('does not update if current version is invalid format', async () => {
        let replaceCalledWith = null;
        const mockLocation = {
            href: 'http://localhost/page.html',
            replace: (url) => { replaceCalledWith = url; }
        };
        const mockFetch = async () => ({
            ok: true,
            json: async () => ({ version: 'invalid-version' })
        });
        const ctx = setupContext(mockLocation, mockFetch);
        await ctx.check();
        assert.strictEqual(replaceCalledWith, null);
    });

    await t.test('does not update if current version is same as release', async () => {
        let replaceCalledWith = null;
        const mockLocation = {
            href: 'http://localhost/page.html',
            replace: (url) => { replaceCalledWith = url; }
        };
        const mockFetch = async () => ({
            ok: true,
            json: async () => ({ version: 'abc123def456' })
        });
        const ctx = setupContext(mockLocation, mockFetch, 'abc123def456');
        await ctx.check();
        assert.strictEqual(replaceCalledWith, null);
    });

    await t.test('does not update if URL already has current version in query param', async () => {
        let replaceCalledWith = null;
        const mockLocation = {
            href: 'http://localhost/page.html?v=111122223333',
            replace: (url) => { replaceCalledWith = url; }
        };
        const mockFetch = async () => ({
            ok: true,
            json: async () => ({ version: '111122223333' })
        });
        const ctx = setupContext(mockLocation, mockFetch);
        await ctx.check();
        assert.strictEqual(replaceCalledWith, null);
    });
});
