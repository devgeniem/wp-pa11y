#!/usr/bin/env node

const fetch = require("node-fetch");
const fs = require("fs");
const https = require("https");
const pa11y = require("pa11y");
const htmlReporter = require("pa11y/lib/reporters/html");
const cliReporter = require("pa11y/lib/reporters/cli");
const path = require("path");
const puppeteer = require("puppeteer");
const { XMLParser } = require("fast-xml-parser");
const { program, Option } = require("commander");

// Configuration.
const pkg = require("./package.json");
const name = "wp-pa11y";
const version = pkg.version || "0.0.0";

const { cosmiconfigSync } = require("cosmiconfig");

const cosmicConfig = cosmiconfigSync(name, {
    searchPlaces: ["package.json"],
});

const searchedFor = cosmicConfig.search();

if (searchedFor === null || searchedFor.isEmpty) {
    console.error(
        "Could not find configuration. Please check docs and try again."
    );
    process.exit(1);
}

// Create base folder for reports to same path as config file.
const configDir = path.dirname(searchedFor.filepath);
const outputDir = path.resolve(configDir, `.${name}`);
if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir);
}

const config = cosmicConfig.load(searchedFor.filepath);

program
    .version(version, "-v, --version", "output the current version")
    .addOption(
        new Option("-o, --output <type>", "output type")
            .choices(["console", "html"])
            .default("console")
            .env("WP_PA11Y_OUTPUT")
    );

program.parse();

const opts = program.opts();

const reportType = opts.output || "console";
let configs = config.config;

if (configs.length === 0) {
    console.error("No sitemaps to process. Exiting.");
    process.exit(0);
}

configs.forEach(async (item) => {
    const folderName = new URL(item.url).hostname
        .replace("www.", "")
        .replace(".", "");

    const dir = path.resolve(outputDir, folderName);

    if (!fs.existsSync(dir) && reportType === "html") {
        fs.mkdirSync(dir, { recursive: true });
    }

    const urlList = await getUrls(item.url);
    const urlObj = {
        folderName,
        urlList,
    };

    if (urlObj.urlList?.length > 0) {
        runPa11y(urlObj, item.config);
    }
});

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
    const parser = new XMLParser();
    const data = parser.parse(content);

    return data.urlset.url.length
        ? data.urlset.url.map((link) => link.loc)
        : [];
}

/**
 * Run Pa11y for given urls
 *
 * @param {object} urlObj Object containing folder name and url list.
 * @param {object} config Object containing pa11y config.
 * @return {void}
 */
async function runPa11y(urlObj, config) {
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
        const issueHashes = [];
        const { folderName, urlList } = urlObj;
        const date = getTimestamp();
        const summaryFileName = `${date}-${folderName}-summary.html`;
        let summaryResults = {};

        for (let i = 0; i < urlList.length; i++) {
            pages.push(await browser.newPage());

            results[i] = await pa11y(urlList[i], {
                ...config,
                browser,
                page: pages[i],
                log: options.log,
                runners: options.runners,
            });

            if (i === 0) {
                summaryResults = results[i];
                summaryResults.issues = [];
            }

            if (results[i].issues.length > 0) {
                // Push only fully unique issues to summary results.
                results[i].issues.forEach((issue) => {
                    const issueHash = `${issue.runner}/${issue.code}/${issue.selector}`;
                    if (!issueHashes.includes(issueHash)) {
                        issueHashes.push(issueHash);
                        summaryResults.issues.push(issue);
                    }
                });
                if (reportType === "html") {
                    // Write both page-specific and summary results to HTML files.
                    // This allows providing a summary even if the execution is stopped.
                    const resultObjects = [
                        {
                            fileName: summaryFileName,
                            results: summaryResults,
                        },
                        {
                            fileName: getFileName(urlList[i]),
                            results: results[i],
                        },
                    ];
                    for (const resultObject of resultObjects) {
                        const htmlResults = await htmlReporter.results(
                            resultObject.results
                        );

                        const htmlOutput = path.resolve(
                            outputDir,
                            folderName,
                            resultObject.fileName
                        );

                        fs.writeFileSync(htmlOutput, htmlResults);
                    }
                } else {
                    console.log(cliReporter.results(results[i]));
                }
            }
        }

        if (reportType === "console") {
            // Write summary object to CLI.
            console.log("Printing summary results of all issues...");
            console.log(cliReporter.results(baseObject));
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

    const date = getTimestamp();

    return `${date}-${fileName}.html`;
}

/**
 * Get current timestamp as a string for file names.
 * @return {string}
 */
function getTimestamp() {
    const dt = new Date();
    return `${dt.getFullYear()}-${dt.getMonth() + 1}-${dt.getDate()}`;
}
