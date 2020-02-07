# wg14.link

[![GitHub Workflow Status (branch)](https://img.shields.io/github/workflow/status/LynnKirby/wg14-link/Continuous%20Integration/master?style=flat-square)](https://github.com/LynnKirby/wg14-link/actions?query=workflow%3A%22Continuous+Integration%22+branch%3Amaster)
[![License: CC0-1.0](https://img.shields.io/badge/license-CC0--1.0-blue?style=flat-square)](./COPYING.txt)

This is the source code for [wg14.link], an unofficial ISO C (WG14) redirect
service. It's like [wg21.link] except for C and with less features!

## How it works

### Change detection

A hash of the WG14 document log webpage is stored at `data/hash.md5` which is
checked by a GitHub actions workflow to notify us of any changes.

### Document data

All documents are listed in `data/documents.yml`. Aliases (like `c99`) are
listed in `data/alias.yml`. These files get parsed at build time to generate a
170 KB JSON data file that our Express application (`app.js`) consumes. Citation
files in BibTeX and CSL-YAML format are also generated.

### Infrastructure

Hosted on Heroku with DNS and caching by Cloudflare.

## Running locally

```sh
# Get source and dependencies
git clone https://github.com/LynnKirby/wg14-link
cd wg14-link
npm install

# Build runtime data
npm run build

# Start local development server
npm run dev
```

## License

Released to the public domain under Creative Commons Zero v1.0 Universal.

[wg14.link]: https://wg14.link
[wg21.link]: https://wg21.link
