const assert = require("assert");
const fs = require("fs");
const path = require("path");
const process = require("process");

const {
  canonicalDocumentId,
  parseDataFileSync,
  parseAuthor,
} = require("../util");

// Make things easy by always operating from the project root directory.
process.chdir(path.join(__dirname, "../"));

const docs = parseDataFileSync("data/documents.yml");
const alias = parseDataFileSync("data/alias.yml");

const rawAuthors = parseDataFileSync("data/authors.yml");
const authorMap = {};

for (let id of Object.keys(rawAuthors)) {
  authorMap[id] = parseAuthor(rawAuthors[id]);
}

const routes = {};

// Add all of the document files.
for (const doc of docs) {
  const id = canonicalDocumentId(doc.id);
  let status = doc.status;

  if (status === "unassigned") {
    routes[id] = { id, status };
    continue;
  }

  if (!(doc.url || doc.mirror)) {
    assert(!doc.status);
    status = "missing";
  }

  // TODO: Authors should be added unconditionally but not all of the docs
  // have been reviewed and have valid author keys.
  const docAuthors = typeof doc.author === "string" ? [doc.author] : doc.author;
  const authors = docAuthors.map(x => authorMap[x]);

  let formattedAuthor = "WG14";
  let skipAuthor = false;

  for (const x of authors) {
    if (x === undefined) {
      skipAuthor = true;
      break;
    }
  }

  if (!skipAuthor) {
    const list = authors.map(x => {
      if (x.literal) return x.literal;
      if (x.given) return `${x.given} ${x.family}`;
      return `${x.family}`;
    });

    if (list.length === 1) {
      formattedAuthor = list[0];
    } else if (list.length === 2) {
      formattedAuthor = `${list[0]} and ${list[1]}`;
    } else {
      list[list.length - 1] = `and ${list[list.length - 1]}`;
      formattedAuthor = list.join(", ");
      list[list.length - 1];
    }
  }

  routes[id] = {
    id,
    url: doc.url,
    mirror: doc.mirror,
    status,
    title: doc.title,
    date: `${doc.date}`,
    author: formattedAuthor,
  };
}

// Add the aliases.
for (let [from, to] of Object.entries(alias)) {
  from = from.toUpperCase();
  to = canonicalDocumentId(to);
  routes[from] = routes[to];
}

// Write the routes file.
fs.mkdirSync("build", { recursive: true });
fs.writeFileSync("build/routes.json", JSON.stringify(routes));
console.log("build/routes.json has been written");
