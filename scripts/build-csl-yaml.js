const fs = require("fs");
const path = require("path");
const process = require("process");
const yaml = require("yaml");

const {
  canonicalDocumentId,
  extractDocumentNumber,
  parseDataFileSync,
  parseAuthor,
  parseDate,
} = require("../util");

// Make things easy by always operating from the project root directory.
process.chdir(path.join(__dirname, "../"));

// Converts an object into a YAML flow-style map.
const makeFlowObject = obj => {
  const node = yaml.createNode(obj);
  node.type = "FLOW_MAP";
  return node;
};

// Convert a year number or YYYY-MM-DD string to CSL JSON date-parts.
const parseDateAsCsl = date => {
  const { year, month, day } = parseDate(date);
  const parts = [year];
  if (month !== undefined) parts.push(month);
  if (day !== undefined) parts.push(day);
  return makeFlowObject({ "date-parts": [parts] });
};

// Prepare data.
fs.mkdirSync("build/public", { recursive: true });
const rawAuthors = parseDataFileSync("data/authors.yml");
const docs = parseDataFileSync("data/documents.yml");

// Parse author file into CSL JSON.
const authorMap = {};

for (let id of Object.keys(rawAuthors)) {
  authorMap[id] = parseAuthor(rawAuthors[id]);
}

const references = [];

// Create citation for all documents.
for (const doc of docs) {
  if (doc.status === "unassigned") {
    continue;
  }

  // Fields that all citations have.
  const id = canonicalDocumentId(doc.id);
  const issued = parseDateAsCsl(doc.issued ? doc.issued : doc.date);

  const cite = {
    id,
    "citation-label": id,
    title: doc.title,
    issued,
    publisher: "WG14",
  };

  // TODO: Authors should be added unconditionally but not all of the docs
  // have been reviewed and have valid author keys.
  const docAuthors = typeof doc.author === "string" ? [doc.author] : doc.author;
  const author = docAuthors.map(x => {
    const mapped = authorMap[x];
    if (mapped === undefined) return undefined;
    return makeFlowObject(mapped);
  });

  let skipAuthor = false;

  for (const x of author) {
    if (x === undefined) {
      skipAuthor = true;
      break;
    }
  }

  if (!skipAuthor) {
    cite.author = author;
  }

  if (doc.mirror || doc.url) {
    cite.URL = `https://wg14.link/${id.toLowerCase()}`;
  }

  references.push(cite);
  fs.writeFileSync(`build/public/${id}.yml`, yaml.stringify(cite));
}

console.log("build/public/N*.yml files have been written");

// Write the index file.
references.sort(
  (a, b) => extractDocumentNumber(a.id) - extractDocumentNumber(b.id)
);
const indexFile = { references };
fs.writeFileSync("build/public/index.yml", yaml.stringify(indexFile));
console.log("build/public/index.yml has been written");
