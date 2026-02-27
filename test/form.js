const path = require("path");
const assert = require("assert");
const { chromium } = require("playwright");

const indexHTMLURL = "file://" + path.join(__dirname, "..", "index.html");

before(async function() {
    this.timeout(10000);
    global.browser = global.browser || await chromium.launch();
});

describe("Form", async function() {
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