const pa11y = require("pa11y");
const cli = require("pa11y-reporter-cli");
const htmlReporter = require("pa11y-reporter-html");
const https = require("https");
const fetch = require("node-fetch");
const xml2js = require("xml2js");
const puppeteer = require("puppeteer");
const fs = require("fs");
const args = process.argv;
const reportType = args[2];

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
        resolve(
            data.urlset.url.length
                ? data.urlset.url.map((link) => link.loc[0])
                : []
        );
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
                info: console.log,
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

            if (reportType === "html") {
                const htmlResults = await htmlReporter.results(results[i]);
                const fileName = getFileName(urls[i]);

                fs.writeFileSync(`./output/${fileName}`, htmlResults);
            } else {
                console.log(cli.results(results[i]));
            }
        }

        for (const page of pages) {
            await page.close();
        }

        await browser.close();
    } catch (error) {
        console.error(error.message);
    }
}

/**
 * Get file name
 *
 * @param {string} url
 * @return {string}
 */
function getFileName(url) {
    let fileName = url
        .toLowerCase()
        .trim()
        .replace(/[^\w\s-]/g, "")
        .replace(/[\s_-]+/g, "-")
        .replace(/^-+|-+$/g, "");

    const dt = new Date();

    return `${dt.getFullYear()}-${
        dt.getMonth() + 1
    }-${dt.getDate()}-${fileName}.html`;
}

sitemaps.forEach(async (url) => {
    const urlList = await getUrls(url);

    if (urlList.length > 0) {
        runPa11y(urlList);
    }
});
