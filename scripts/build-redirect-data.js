const assert = require("assert");
const { canonicalDocumentId, parseDataFileSync } = require("../util");
const fs = require("fs");
const path = require("path");
const process = require("process");

// Make things easy by always operating from the project root directory.
process.chdir(path.join(__dirname, "../"));

const docs = parseDataFileSync("data/documents.yml");
const alias = parseDataFileSync("data/alias.yml");

const redirects = {};

// Add all of the document files.
for (let { id, url, mirror, status } of docs) {
  if (!(url || mirror) && status !== "unassigned") {
    assert(!status);
    status = "missing";
  }

  id = canonicalDocumentId(id);
  redirects[id] = { url, mirror, status };
}

// Add the aliases.
for (let [from, to] of Object.entries(alias)) {
  from = from.toLowerCase();
  to = canonicalDocumentId(to);
  const { url, mirror, status } = redirects[to];
  redirects[from] = { url, mirror, status };
}

// Write the redirect file.
fs.mkdirSync("build", { recursive: true });
fs.writeFileSync("build/redirect.json", JSON.stringify(redirects));
console.log("build/redirect.json has been written");
