# WP-Pa11y

Run [pa11y](https://github.com/pa11y/pa11y) to each page on your sitemaps.

## Installation instructions

### As a global npm package

*TBA*

### As a project npm dependency

*TBA*

### `git` Clone

1. Clone the repository to your chosen location (choose wisely, this will be the folder you will be running `wp-pa11y` from)
2. Run `npm install` inside the folder
3. Set up your `sitemaps.txt` (see section "Configuration")
4. Run the app (see section "Running the app")

## Configuration

`wp-pa11y` reads sitemaps from one of two locations.

You can use either `sitemaps.txt` file or `wp-pa11y` key in the project `package.json` file (examples below).

`wp-pa11y` prefers `sitemaps.txt` to `package.json`, so use one of them to avoid confusion.

### Using `sitemaps.txt`

Create file `sitemaps.txt` and add each sitemap.xml to its own line.

```
https://example.com/sitemap.xml
https://subdomain.example.com/sitemap.xml
```

If you are still confused, see `sitemaps.txt.example`.

### Using `package.json`

Add `wp-pa11y` array to your project root `package.json` and add sitemaps as array items.

```json
{
  "name": "your-project",
  "version": "x.y.z",
  "dependencies": {},
  "devDependencies": {},
  "wp-pa11y": [
    "https://example.com/sitemap.xml",
    "https://subdomain.example.com/sitemap.xml"
  ]
}
```

## Running the app

### Using `wp-pa11y`

Depending on installation method, the command might be `node wp-pa11y.js` or `node node_modules/.bin/wp-pa11y`.

Running without any options' app checks sitemaps and outputs reports to the CLI.

To see all available options and arguments run `wp-pa11y --help`.

### From git clone (using `make`)

| command     | Description                                            |
|-------------|--------------------------------------------------------|
| `make html` | Generates HTML reports to `./output/{domain}/` folder. |
| `make cli`  | Outputs reports to cli.                                |

## Contributors

[See up-to-date list of project contributors](https://github.com/devgeniem/wp-pa11y/graphs/contributors).

## License

MIT License
