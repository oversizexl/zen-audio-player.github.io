const path = require("path");
const assert = require("assert");
const { chromium } = require("playwright");

const indexHTMLURL = "file://" + path.join(__dirname, "..", "index.html");

before(async function() {
    this.timeout(10000);
    global.browser = global.browser || await chromium.launch();
});

describe("Form", async function() {
    it("should show warning and allow direct ID playback when API is skipped", async function() {
        this.timeout(20000);
        const page = await browser.newPage();
        await page.goto(indexHTMLURL);

        const warningElement = await page.waitForSelector(".warning-message", { state: "visible" });
        const warningText = ((await warningElement.textContent()) || "").toLowerCase();
        assert.ok(
            warningText.includes("youtube data api"),
            `Warning text should mention YouTube Data API, got: "${warningText}"`
        );

        const typeaheadMenu = await page.$(".tt-menu");
        assert.strictEqual(typeaheadMenu, null,
            "Typeahead menu (.tt-menu) should not be present when YouTube Data API is skipped");

        const typeaheadHint = await page.$(".tt-hint");
        assert.strictEqual(typeaheadHint, null,
            "Typeahead hint input (.tt-hint) should not be present when YouTube Data API is skipped");

        const searchInput = await page.$(".search-input");
        assert.ok(searchInput, "Search input should exist");
        const directVideoId = "dQw4w9WgXcQ";
        await searchInput.fill(directVideoId);
        await searchInput.press("Enter");

        const playerFrame = await page.waitForSelector(
            'iframe[src*="youtube.com"], iframe[src*="youtube-nocookie.com"]',
            { state: "attached", timeout: 10000 }
        );
        assert.ok(playerFrame, "Player iframe should be rendered for direct video ID search");

        await page.close();
    });

    it("should display error element and allow programmatic control", async function() {
        const page = await browser.newPage();
        await page.goto(indexHTMLURL);

        // Test that error element exists and can be controlled
        const errorElement = await page.$(".error-message");
        assert.ok(errorElement, "Error element should exist");
        
        // Test that we can programmatically show/hide the error
        await errorElement.evaluate(el => el.textContent = "Test error message");
        await errorElement.evaluate(el => el.classList.remove("hide"));
        assert.notEqual(await errorElement.getAttribute("class"), "hide", "Error element should be visible");
        
        // Test that we can hide it programmatically
        await errorElement.evaluate(el => el.classList.add("hide"));
        assert.ok((await errorElement.getAttribute("class") || "").includes("hide"), "Error element should be hidden");
        
        // Test we can clear it
        await errorElement.evaluate(el => el.textContent = "");
        assert.equal(await errorElement.textContent(), "", "Error element should be clear");

        await page.close();
    });
});

after(async () => {
    if (browser) {
        await browser.close();
    }
});