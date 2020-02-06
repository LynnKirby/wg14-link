# [wg14.link]
> unofficial ISO C (WG14) redirect service

It's like [wg21.link] except for C and with less features!

## How it works

### Change detection

A hash of the WG14 document log webpage is stored at `data/hash.md5` which is
checked by a GitHub actions workflow to notify us of any changes.

### Document data

All documents are listed in `data/documents.yml`. Aliases (like `c99`) are
listed in `data/alias.yml`. These files get parsed at build time by
`scripts/make-redirect-data.js` to generate a 170 KB JSON data file that our
Express application (`app.js`) consumes.

### Infrastructure

Hosted on Heroku with DNS and caching by Cloudflare.

## License

Released to the public domain under Creative Commons Zero v1.0 Universal.

[wg14.link]: https://wg14.link
[wg21.link]: https://wg21.link
