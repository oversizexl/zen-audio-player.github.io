const fs = require("fs");
const path = require("path");
const assert = require("assert");
const puppeteer = require("puppeteer");
const { getPuppeteerConfig } = require("./puppeteer-config");

const indexHTMLURL = "file://" + path.join(__dirname, "..", "index.html");

async function getProperty(page, selector, property) {
    return await (await (await page.waitForSelector(selector, { timeout: 5000 })).getProperty(property)).jsonValue();
}

before(async function() {
    this.timeout(10000);
    global.browser = global.browser || await puppeteer.launch(getPuppeteerConfig());
});

describe("Page Structure", async function() {
    it("should have required HTML elements", async function() {
        const page = await browser.newPage();
        await page.goto(indexHTMLURL);

        assert.ok(await page.waitForSelector("html"), "Couldn't find <html>, wow!");
        assert.ok(await page.waitForSelector("head"), "Couldn't find <head>, wow!");
        assert.ok(await page.waitForSelector("body"), "Couldn't find <body>, wow!");
        assert.ok(await page.waitForSelector("title"), "Couldn't find <title>, wow!");

        await page.close();
    });
    it("should have expected metadata", async function () {
        this.timeout(8000);
        const page = await browser.newPage();
        await page.goto(indexHTMLURL, { waitUntil: "domcontentloaded" });

        assert.equal(page.url(), indexHTMLURL);

        // Use more specific selectors instead of fragile sibling selectors
        const metas = await page.$$("meta");
        let foundDescription = false, foundAuthor = false, foundViewport = false, foundGoogleVerification = false;

        for (const meta of metas) {
            const name = await meta.getProperty("name");
            const content = await meta.getProperty("content");
            const nameValue = await name.jsonValue();
            const contentValue = await content.jsonValue();

            if (nameValue === "description" && contentValue === "Listen to YouTube videos, without the distracting visuals") {
                foundDescription = true;
            }
            if (nameValue === "author" && contentValue === "Shakeel Mohamed") {
                foundAuthor = true;
            }
            if (nameValue === "viewport" && contentValue === "width=device-width, initial-scale=1") {
                foundViewport = true;
            }
            if (nameValue === "google-site-verification" && contentValue === "D3SjNR3tmNYOusESQijh_oH5SGmU9QsAIVwlqizwRBU") {
                foundGoogleVerification = true;
            }
        }

        assert.ok(foundDescription, "Description meta tag not found");
        assert.ok(foundAuthor, "Author meta tag not found");
        assert.ok(foundViewport, "Viewport meta tag not found");
        assert.ok(foundGoogleVerification, "Google site verification meta tag not found");

        assert.equal(await getProperty(page, "title", "text"), "Zen Audio Player");

        await page.close();
    });

    it("should have favicon configured correctly", async function () {
        this.timeout(8000);
        const page = await browser.newPage();
        await page.goto(indexHTMLURL, { waitUntil: "domcontentloaded" });

        const faviconPath = path.join("img", "favicon.ico");
        assert.ok(fs.existsSync(faviconPath));

        // Find all link elements and check for favicon configurations
        const links = await page.$$("link");
        let foundShortcutIcon = false, foundIcon = false;

        for (const link of links) {
            const rel = await link.getProperty("rel");
            const href = await link.getProperty("href");
            const type = await link.getProperty("type");
            const relValue = await rel.jsonValue();
            const hrefValue = await href.jsonValue();
            const typeValue = await type.jsonValue();

            if (relValue === "shortcut icon" && hrefValue.includes("img/favicon.ico") && typeValue === "image/x-icon") {
                foundShortcutIcon = true;
            }
            if (relValue === "icon" && hrefValue.includes("img/favicon.ico") && typeValue === "image/x-icon") {
                foundIcon = true;
            }
        }

        assert.ok(foundShortcutIcon, "Shortcut icon link not found");
        assert.ok(foundIcon, "Icon link not found");

        await page.close();
    });
    it("should have CSS files configured correctly", async function () {
        this.timeout(8000);
        const page = await browser.newPage();
        await page.goto(indexHTMLURL, { waitUntil: "domcontentloaded" });

        const preloadStylesheet = "preload stylesheet";

        // Find all link elements and check for CSS configurations
        const links = await page.$$("link");
        let foundPrimerCSS = false, foundFontAwesome = false, foundPlyrCSS = false, foundLocalCSS = false;

        for (const link of links) {
            const rel = await link.getProperty("rel");
            const href = await link.getProperty("href");
            const relValue = await rel.jsonValue();
            const hrefValue = await href.jsonValue();

            if (relValue === preloadStylesheet && hrefValue.match(/https:\/\/unpkg\.com\/primer-css@[~^]?\d.+\/css\/primer\.css/)) {
                foundPrimerCSS = true;
            }
            if (relValue === preloadStylesheet && hrefValue.match(/https:\/\/unpkg\.com\/font-awesome@[~^]?\d.+\/css\/font-awesome\.min\.css/)) {
                foundFontAwesome = true;
            }
            if (relValue === preloadStylesheet && hrefValue.match(/https:\/\/unpkg\.com\/plyr@[~^]?\d.+\/dist\/plyr\.css/)) {
                foundPlyrCSS = true;
            }
            if (relValue === preloadStylesheet && hrefValue.endsWith("css/styles.css")) {
                foundLocalCSS = true;
            }
        }

        assert.ok(foundPrimerCSS, "Primer CSS stylesheet not found");
        assert.ok(foundFontAwesome, "Font Awesome stylesheet not found");
        assert.ok(foundPlyrCSS, "Plyr CSS stylesheet not found");
        assert.ok(foundLocalCSS, "Local CSS stylesheet not found");

        await page.close();
    });
    it("should have logo configured correctly", async function () {
        this.timeout(8000);
        const page = await browser.newPage();
        await page.goto(indexHTMLURL, { waitUntil: "domcontentloaded" });

        const imgFolderPath = path.join(__filename, "..", "..", "img") + path.sep;

        assert.ok(fs.existsSync(imgFolderPath) + "zen-audio-player-113.png");
        assert.ok(fs.existsSync(imgFolderPath) + "zen-audio-player-453.png");
        assert.ok(fs.existsSync(imgFolderPath) + "zen-audio-player-905.png");

        assert.equal(await getProperty(page, "header > figure > a", "href"), "https://zen-audio-player.github.io/");
        assert.ok((await getProperty(page, "header > figure > a.zen-logo > img.img-100", "src")).indexOf("img/zen-audio-player-905.png") !== -1);
        assert.equal(await getProperty(page, "header > figure > a.zen-logo > img.img-100", "alt"), "Zen Audio Player logo");

        await page.close();
    });
    it("should have expected elements", async function () {
        const page = await browser.newPage();
        await page.goto(indexHTMLURL);

        assert.ok(page.$("header"), "Couldn't find header");
        assert.ok(page.$("header > figure"), "Couldn't find <header><figure>");
        assert.ok(page.$("header > figure > a"), "Couldn't find <header><figure><a>");
        assert.ok(page.$("header > figure > a.zen-logo > img.img-100"), "Couldn't find <header><figure><a><img>");
        assert.ok(page.$("#form"), "Couldn't find #form");

        // TODO: validate the rest of the form
        assert.ok(page.$("#demo"), "Couldn't find #demo");
        assert.ok(page.$("#submit"), "Couldn't find #submit");
        assert.ok(page.$("#zen-error"), "Couldn't find #zen-error");
        assert.ok(page.$("#zen-video-title"), "Couldn't find #zen-video-title");
        assert.ok(page.$("h3 > a#zen-video-title"), "Couldn't find a h3 > a#zen-video-title");
        assert.ok(page.$("#audioplayer"), "Couldn't find #audioplayer");
        assert.ok(page.$("#audioplayer > div.plyr"), "Couldn't find #audioplayer > div.plyr");

        assert.ok(page.$("footer"), "Couldn't find footer");
        assert.ok(page.$("footer > div.color-grey > p"), "Couldn't find footer > div.color-grey <p>Created by");
        assert.ok(page.$("footer > div.color-grey > p ~ p"), "Couldn't find footer > div.color-grey<p>Created by...</p><p>");
        assert.ok(page.$("footer > div.repo-info > p"), "Couldn't find footer > div.repo-info<p>Source available on GitHub...</p><p>");

        await page.close();
    });
    it("should not have strange HTML elements", async function () {
        const page = await browser.newPage();
        await page.goto(indexHTMLURL);

        // These are more of a sanity check than anything else
        assert.ok(! await page.$("chicken"), "Found unexpected <chicken> element");
        assert.ok(! await page.$("soup"), "Found unexpected <soup> element");
        assert.ok(! await page.$("for"), "Found unexpected <for> element");
        assert.ok(! await page.$("the"), "Found unexpected <the> element");
        assert.ok(! await page.$("code"), "Found unexpected <code> element");

        await page.close();
    });
});

after(async () => {
    if (browser) {
        await browser.close();
    }
});
