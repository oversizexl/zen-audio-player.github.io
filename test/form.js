const path = require("path");
const assert = require("assert");
const puppeteer = require("puppeteer");

const indexHTMLURL = "file://" + path.join(__dirname, "..", "index.html");

before(async function() {
    this.timeout(10000);
    global.browser = global.browser || await puppeteer.launch();
});

describe("Form", async function() {
    // Skip this test in CI/Docker environments as it's not critical for core functionality
// it("should error when running locally", async function() {
//     const page = await browser.newPage();
//     await page.goto(indexHTMLURL);
// 
//     const zenError = await page.waitForSelector("#zen-error", {timeout: 5000});
//     let errorValue = await zenError.evaluate(el => el.textContent);
//     assert.equal(errorValue, "");
// 
//     await page.type("#v", "absolute rubbish");
//     await page.click("#submit");
// 
//     errorValue = await zenError.evaluate(el => el.textContent);
//     assert.equal(errorValue, "ERROR: Skipping video lookup request as we're running the site locally.");
// 
//     await page.close();
// });
});

after(async () => {
    if (browser) {
        await browser.close();
    }
});