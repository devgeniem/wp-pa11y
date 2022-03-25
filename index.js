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
const outputDir = './output';

if ( ! fs.existsSync('./sitemaps.txt')) {
    console.error('Create sitemaps.txt');
    return;
}

const sitemaps = fs.readFileSync('./sitemaps.txt', 'utf8').split("\n").filter((a) => a.length) ;

if( sitemaps.length === 0) {
    console.error('Empty sitemaps.txt');
    return;
}
else {
    console.log('Running Pa11y for ', sitemaps.join(', '));

    sitemaps.forEach(async (url) => {
        const folderName = (new URL(url)).hostname.replace("www.","").replace(".","");
        const dir = `./${outputDir}/${folderName}`;

        if (!fs.existsSync(dir) && reportType === "html"){
            fs.mkdirSync(dir, { recursive: true });
        }

        const urlList = await getUrls(url);
        const urlObj = {
            folderName,
            urlList,
        };

        if (urlObj.urlList.length > 0) {
            runPa11y(urlObj);
        }
    });
}

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
 * @param {object} urlObj Object containing folder name and url list.
 * @return {void}
 */
async function runPa11y(urlObj) {
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
        const { folderName, urlList } = urlObj;

        for (let i = 0; i < urlList.length; i++) {
            pages.push(await browser.newPage());

            results[i] = await pa11y(urlList[i], {
                browser,
                page: pages[i],
                log: options.log,
                runners: options.runners,
            });

            if (reportType === "html") {
                const htmlResults = await htmlReporter.results(results[i]);
                const fileName = getFileName(urlList[i]);
                fs.writeFileSync(`./${outputDir}/${folderName}/${fileName}`, htmlResults);
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
        .replace(/^-+|-+$/g, "")
        .replace("httpswww", "");

    const dt = new Date();

    return `${dt.getFullYear()}-${
        dt.getMonth() + 1
    }-${dt.getDate()}-${fileName}.html`;
}
