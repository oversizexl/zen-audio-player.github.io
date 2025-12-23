// Test configuration that works with Puppeteer container
const getPuppeteerConfig = () => {
    return {
        args: [
            "--no-sandbox",
            "--disable-setuid-sandbox",
            "--disable-dev-shm-usage",
            "--disable-extensions",
            "--disable-gpu",
            "--no-default-browser-check"
        ],
        headless: "new"
    };
};

module.exports = { getPuppeteerConfig };