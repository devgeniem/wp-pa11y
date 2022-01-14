const pa11y = require("pa11y");
const cli = require("pa11y-reporter-cli");
const https = require("https");
const fetch = require("node-fetch");
const xml2js = require("xml2js");
const puppeteer = require("puppeteer");

const sitemaps = ["https://asiakas.test/sitemap.xml"];

/**
 * Get urls from sitemap
 *
 * @param {string} url
 * @returns {Promise}
 */
async function getUrls(url) {
    // Bypass self-signed cert
    const httpsAgent = new https.Agent({
        rejectUnauthorized: false,
    });

    const response = await fetch(url, { method: "GET", agent: httpsAgent });
    const content = await response.text();
    const parser = new xml2js.Parser();
    const data = await parser.parseStringPromise(content);

    return new Promise((resolve) => {
        resolve(data.urlset.url.length ? data.urlset.url.map((link) => link.loc[0]): []);
    });
}

/**
 * Run Pa11y for given urls
 *
 * @param {array} urls Array of urls.
 * @return {void}
 */
async function runPa11y(urls) {
    let browser;
    let pages = [];

    try {
        const options = {
            log: {
                debug: console.log,
                error: console.error,
                info: console.log
            },
            runners: ["axe", "htmlcs"],
        };

        browser = await puppeteer.launch();
        const results = [];

        for (let i = 0; i < urls.length; i++) {
            pages.push(await browser.newPage());

            results[i] = await pa11y(urls[i], {
                browser,
                page: pages[i],
                log: options.log,
                runners: options.runners,
            });
        }

        results.forEach((result) => {
            console.log(cli.results(result));
        });

        for (const page of pages) {
            await page.close();
        }

        await browser.close();
    } catch (error) {
        console.error(error.message);
    }
}

sitemaps.forEach(async (url) => {
    const urlList = await getUrls(url);

    if (urlList.length > 0) {
        runPa11y(urlList);
    }
});
