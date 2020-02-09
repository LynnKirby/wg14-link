const app = require("../app");
const axios = require("axios").default;
const http = require("http");
const listen = require("test-listen");
const test = require("ava");

//
// Setup and teardown.
//

test.beforeEach(async t => {
  t.context.server = http.createServer(app);
  const baseURL = await listen(t.context.server);
  t.context.request = axios.create({
    baseURL,
    responseType: "text",
    validateStatus: null,
  });
});

test.afterEach.always(t => {
  t.context.server.close();
});

//
// Route tests.
//

const servedFilesToTest = {
  "/": {
    contentType: "text/html",
    data: "<title>wg14.link</title>",
  },
  "/index.bib": {
    contentType: "text/plain",
    data: "^@misc{N001",
  },
  "/index.yml": {
    contentType: "text/plain",
    data: "^references:",
  },
  "/index.yaml": {
    contentType: "text/plain",
    data: "^references:",
  },
  "/N666": {
    headers: { "user-agent": "facebookexternalhit" },
    contentType: "text/html",
    data: `<meta property="og:url" content="https://wg14.link/n666">`,
  },
};

for (const [url, opts] of Object.entries(servedFilesToTest)) {
  test(`${url} should be served`, async t => {
    const contentType = `${opts.contentType}; charset=utf-8`;
    const data = new RegExp(opts.data);
    const headers = opts.headers || {};

    const res = await t.context.request({ url, headers });

    t.is(res.status, 200);
    t.is(res.headers["content-type"].toLowerCase(), contentType);
    t.regex(res.data, data);
  });
}

const redirectsToTest = {
  "/n1234": "http://www.open-std.org/jtc1/sc22/wg14/www/docs/n1234.htm",
  "/c99": "http://www.open-std.org/jtc1/sc22/wg14/www/docs/n1256.pdf",
};

for (const [from, to] of Object.entries(redirectsToTest)) {
  test(`${from} should redirect`, async t => {
    const res = await t.context.request({
      url: from,
      maxRedirects: 0,
    });
    t.is(res.status, 302);
    t.is(res.headers["location"], to);
  });
}

test("/doesnotexist should give 404", async t => {
  const res = await t.context.request("/doesnotexist");
  t.is(res.status, 404);
});
