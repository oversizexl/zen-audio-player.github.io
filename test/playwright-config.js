// Test configuration that works with Playwright
const { devices } = require("@playwright/test");

const getPlaywrightConfig = () => {
    return {
        // Use Chromium browser
        browserName: "chromium",

        // Browser launch arguments equivalent to Puppeteer config
        launchOptions: {
            args: [
                "--no-sandbox",
                "--disable-setuid-sandbox",
                "--disable-dev-shm-usage",
                "--disable-extensions",
                "--disable-gpu",
                "--no-default-browser-check"
            ],
            headless: true, // Always run in headless mode
        },

        // Context options for additional configuration
        contextOptions: {
            // Set viewport size if needed
            viewport: { width: 1280, height: 720 },
            // User agent can be set here if needed
            userAgent: devices["Desktop Chrome"].defaultUserAgent,
        }
    };
};

module.exports = { getPlaywrightConfig };