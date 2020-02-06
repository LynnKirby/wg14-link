const assert = require("assert");
const fs = require("fs");
const path = require("path");
const process = require("process");
const yaml = require("js-yaml");

// Make things easy by always operating from the project root directory.
process.chdir(path.join(__dirname, "../"));

const readData = filename => yaml.load(fs.readFileSync(filename), { filename });

const docs = readData("data/documents.yml");
const alias = readData("data/alias.yml");

// Canonicalize document ID to n# without leading zeroes.
const canonicalDocumentId = id => {
  assert(id.match("^N[0-9]+$"));
  const n = Number.parseInt(id.substr(1), 10);
  return "n" + n;
};

const redirects = {};

// Add all of the document files.
for (let { id, url, status } of docs) {
  const redirect = {};

  id = canonicalDocumentId(id);

  // Default status when not provided.
  if (status === undefined) {
    status = "found";
  }

  // Figure out the URL and action based on the document status.
  if (status === "missing" || status === "unassigned") {
    // Document file is missing or is unassigned.
    redirect.status = status;
  } else {
    // Document file is found.
    assert((status === "found") || (status === "protected"));
    redirect.url = url;
  }

  assert(redirects[id] === undefined, `duplicate ID found: ${id}`);
  redirects[id] = redirect;
}

// Add the aliases.
for (let [from, to] of Object.entries(alias)) {
  from = from.toLowerCase();
  to = canonicalDocumentId(to);
  const redirect = redirects[to];
  assert(redirect !== undefined);
  assert(redirect.url !== undefined);
  assert(redirects[from] === undefined);
  redirects[from] = { url: redirect.url };
}

// Write the redirect file.
fs.mkdirSync("build", { recursive: true });
fs.writeFileSync("build/redirect.json", JSON.stringify(redirects));
console.log("build/redirect.json has been written");
