const path = require("path");
const assert = require("assert");
const { chromium } = require("playwright");
const { getPlaywrightConfig } = require("./playwright-config");

const indexHTMLURL = "file://" + path.join(__dirname, "..", "index.html");
let _js = "";

before(async function() {
    this.timeout(10000);
    global.browser = global.browser || await chromium.launch(getPlaywrightConfig().launchOptions);
});

describe("JavaScript components", async function() {
    it("should load TrackJS token", async function() {
        this.timeout(8000);
        const page = await browser.newPage();
        await page.goto(indexHTMLURL, { waitUntil: "domcontentloaded" });

        // Wait for TrackJS to be available
        await page.waitForFunction(() => window._trackJs && window._trackJs.token, { timeout: 5000 });

        const trackjs = await page.evaluate(() => {
            return window._trackJs;
        });

        assert.strictEqual(Object.keys(trackjs).length, 1);
        assert.ok(trackjs.token);
        assert.strictEqual(trackjs.token.length, 32);

        const jQuery = await page.evaluate(() => {
            return Object.keys(window).includes("jQuery");
        });
        assert.ok(jQuery);

        await page.close();
    });
    it("should load jQuery", async function() {
        this.timeout(8000);
        const page = await browser.newPage();
        await page.goto(indexHTMLURL, { waitUntil: "domcontentloaded" });

        const j = await page.evaluate(() => {
            return Object.keys(window).includes("jQuery");
        });
        assert.ok(j);

        await page.close();
    });

    it("should load DOMPurify and sanitize", async function() {
        this.timeout(8000);
        const page = await browser.newPage();
        await page.goto(indexHTMLURL, { waitUntil: "domcontentloaded" });

        // Wait for DOMPurify to be available
        await page.waitForFunction(() => window.DOMPurify, { timeout: 5000 });

        const dp = await page.evaluate(() => {
            return Object.keys(window).includes("DOMPurify");
        });
        assert.ok(dp, "DOMPurify should be loaded on the page.");

        const sanitizedOutput = await page.evaluate(() => {
            const dirty = "<img src=\"x\" onerror=\"alert(1)\">";
            return window.DOMPurify.sanitize(dirty);
        });
        assert.strictEqual(sanitizedOutput, "<img src=\"x\">", "DOMPurify should sanitize malicious scripts correctly.");

        await page.close();
    });

    // TODO: implement this test! _js is always empty
    it("should make all requests over https, not http", async function() {
        this.timeout(8000);
        const page = await browser.newPage();
        await page.goto(indexHTMLURL, { waitUntil: "domcontentloaded" });

        assert.strictEqual(-1, _js.indexOf("http://"), "Please use HTTPS for all scripts");

        await page.close();
    });
});

after(async () => {
    if (global.browser) {
        await browser.close();
    }
});