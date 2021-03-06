const fs = require("fs-extra");
const process = require("process");

const {
  canonicalDocumentId,
  extractDocumentNumber,
  parseDataFileSync,
  parseAuthor,
  parseDate,
  paths,
} = require("../util");

// Make things easy by always operating from the project root directory.
process.chdir(paths.root);

// Prepare data.
fs.mkdirpSync(paths.citationDirectory);
const rawAuthors = parseDataFileSync(paths.authors);
const docs = parseDataFileSync(paths.documents);

// Escape string for LaTeX.
const escape = str => str.replace(/"/g, `\\"`);

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

  const props = [];
  const id = canonicalDocumentId(doc.id);

  const { year, month } = parseDate(doc.date);

  // TODO: Authors should be added unconditionally but not all of the docs
  // have been reviewed and have valid author keys.
  const docAuthors = typeof doc.author === "string" ? [doc.author] : doc.author;
  const authors = docAuthors.map(x => authorMap[x]);

  let skipAuthor = false;

  for (const x of authors) {
    if (x === undefined) {
      skipAuthor = true;
      break;
    }
  }

  if (!skipAuthor) {
    const formattedAuthor = escape(
      authors
        .map(x => {
          if (x.literal) return x.literal;
          if (x.given) return `${x.given} {${x.family}}`;
          return `{${x.family}}`;
        })
        .join(" and ")
    );

    props.push(`author = "${formattedAuthor}"`);
  }

  props.push(`title = "{${id}}: ${escape(doc.title)}"`);
  props.push(`year = ${year}`);

  if (month) {
    props.push(`month = ${month}`);
  }

  if (doc.mirror || doc.url) {
    props.push(`howpublished = "\\url{https://wg14.link/${id.toLowerCase()}}"`);
  }

  props.push(`publisher = "WG14"`);

  const cite = `@misc{${id},\n\t${props.join(",\n\t")}\n}`;
  fs.writeFileSync(`${paths.citationDirectory}/${id}.bib`, cite);
  references.push({ id, cite });
}

console.log("build-bibtex.js: wrote BibTeX citations");

// Write the index file.
references.sort(
  (a, b) => extractDocumentNumber(a.id) - extractDocumentNumber(b.id)
);
const indexFile = references.map(x => x.cite).join("\n\n");
fs.writeFileSync(`${paths.citationDirectory}/index.bib`, indexFile);
console.log("build-bibtex.js: wrote BibTeX bibliography");
