const assert = require("assert");
const { canonicalDocumentId, parseDataFileSync } = require("../util");
const fs = require("fs");
const path = require("path");
const process = require("process");
const yaml = require("yaml");

// Make things easy by always operating from the project root directory.
process.chdir(path.join(__dirname, "../"));

fs.mkdirSync("build/public", { recursive: true });

const rawAuthors = parseDataFileSync("data/authors.yml");
const docs = parseDataFileSync("data/documents.yml");

// Lazy deep clone.
const easyClone = obj => JSON.parse(JSON.stringify(obj));

// Parse author file into CSL JSON.
const authorMap = {};

const parseAuthor = raw => {
  const segments = raw.split("||");
  assert(segments.length === 1 || segments.length === 2);

  // Institution.
  if (segments.length === 1) {
    return { literal: raw.trim() };
  }

  // Unknown given name.
  if (segments[1] === "") {
    return { family: segments[0].trim() };
  }

  // Full name.
  return { family: segments[0].trim(), given: segments[1].trim() };
};

for (let id of Object.keys(rawAuthors)) {
  authorMap[id] = parseAuthor(rawAuthors[id]);
}

// Parse a string or number into a CSL date-parts object.
const dateRegexp = /^([0-9]{4})(-[0-9]{2})?(-[0-9]{2})?$/;

const parseDate = obj => {
  // If the YAML data file has just the year, it gets parsed as a number.
  if (typeof obj === "number") {
    return { "date-parts": [[obj]] };
  }

  assert(typeof obj === "string");
  const match = obj.match(dateRegexp);
  const parts = [Number.parseInt(match[1], 10)];

  if (match[2]) {
    parts.push(Number.parseInt(match[2], 10));
  }

  if (match[3]) {
    parts.push(Number.parseInt(match[3], 10));
  }

  return { "date-parts": [parts] };
};

const references = [];

// Create citation for all documents.
for (const doc of docs) {
  if (doc.status === "unassigned") {
    continue;
  }

  // Fields that all citations have.
  const id = canonicalDocumentId(doc.id);
  const issued = doc.issued ? parseDate(doc.issued) : parseDate(doc.date);

  const cite = {
    id,
    "citation-label": id,
    title: doc.title,
    issued,
  };

  // TODO: Authors should be added unconditionally but not all of the docs
  // have been reviewed and have valid author keys.
  const docAuthors = typeof doc.author === "string" ? [doc.author] : doc.author;
  const author = docAuthors.map(x => authorMap[x]);

  if (author[0] !== undefined) {
    cite.author = author;
  }

  // Optional fields.
  if (doc.mirror || doc.url) {
    cite.URL = `https://wg14.link/${id.toLowerCase()}`;
  }

  if (doc.publisher !== undefined) {
    cite.publisher = doc.publisher;
  }

  if (doc.place !== undefined) {
    cite["publisher-place"] = doc.place;
  }

  if (doc.journal !== undefined) {
    cite.type = "article-journal";
    cite["container-title"] = doc.journal;
  }

  if (doc.book !== undefined) {
    cite.type = "chapter";
    cite["container-title"] = doc.book;
  }

  if (doc.page !== undefined) {
    cite.page = `${doc.page}`;
  }

  if (doc.volume !== undefined) {
    cite.volume = `${doc.volume}`;
  }

  if (doc.issue !== undefined) {
    cite.issue = `${doc.issue}`;
  }

  if (doc.number !== undefined) {
    cite.number = `${doc.number}`;
  }

  references.push(cite);
  fs.writeFileSync(`build/public/${id}.yml`, yaml.stringify(cite));
}

console.log("build/public/N*.yml files have been written");

// Write the index file.
references.sort((a, b) => a.id.localeCompare(b.id));
// The object is deep cloned so that our too-smart yaml package doesn't add
// anchors and aliases where we've reused objects (e.g. all the names).
const indexFile = { references: easyClone(references) };
fs.writeFileSync("build/public/index.yml", yaml.stringify(indexFile));
console.log("build/public/index.yml has been written");
