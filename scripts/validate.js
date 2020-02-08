const Ajv = require("ajv");
const assert = require("assert");
const execa = require("execa");
const fs = require("fs-extra");
const json = require("@stoplight/json");
const yaml = require("@stoplight/yaml");

const { extractDocumentNumber, report } = require("../util");

const paths = {
  alias: "data/alias.yml",
  authors: "data/authors.yml",
  documents: "data/documents.yml",
  routes: "build/routes.json",
  bibtexIndex: "build/public/index.bib",
};

//
// Utilities.
//

const getJsonLocation = (doc, dataPath) => {
  if (typeof dataPath === "string") {
    assert(dataPath[0] === "/");
    dataPath = dataPath.split("/").slice(1);
  } else {
    assert(Array.isArray(dataPath));
  }

  const location = json.getLocationForJsonPath(doc, dataPath);
  const { line, character } = location.range.start;
  return { line: line + 1, column: character + 1 };
};

const getYamlLocation = (doc, dataPath) => {
  if (typeof dataPath === "string") {
    assert(dataPath[0] === "/");
    dataPath = dataPath.split("/").slice(1);
  } else {
    assert(Array.isArray(dataPath));
  }

  const location = yaml.getLocationForJsonPath(doc, dataPath);
  const { line, character } = location.range.start;
  return { line: line + 1, column: character + 1 };
};

//
// Parsing and schema validation of text.
//

const parseJson = (text, file) => {
  file = file || "<unknown>";
  const doc = json.parseWithPointers(text);
  if (doc.diagnostics.length === 0) return doc;

  for (const err of doc.diagnostics) {
    console.log(err);
    // The parser messages are just the error enums as text, which doesn't
    // look very nice. This does "ValueExpected" -> "value expected"
    const message = err.message
      .split(/(?=[A-Z])/)
      .join(" ")
      .toLowerCase();
    const line = err.range.start.line + 1;
    const column = err.range.start.character + 1;
    report(file, message, line, column);
  }

  return undefined;
};

const parseYaml = (text, file) => {
  file = file || "<unknown>";
  const doc = yaml.parseWithPointers(text);
  if (doc.diagnostics.length === 0) return doc;

  for (const err of doc.diagnostics) {
    const line = err.range.start.line + 1;
    const column = err.range.start.character + 1;
    report(file, err.message, line, column);
  }

  return undefined;
};

const parseJsonSchema = (text, file) => {
  file = file || "<unknown>";
  const doc = parseJson(text, file);
  if (doc === undefined) return undefined;

  const ajv = new Ajv({ jsonPointers: true });

  if (ajv.validateSchema(doc.data)) {
    return ajv.compile(doc.data);
  }

  for (const err of ajv.errors) {
    report(file, `data${err.dataPath} ${err.message}`);
  }

  return undefined;
};

const validateJson = (doc, schema, file) => {
  file = file || "<unknown>";

  if (doc === undefined) return false;

  if (schema(doc.data)) return true;

  for (const err of schema.errors) {
    const { line, column } = getJsonLocation(doc, err.dataPath);
    report(file, err.message, line, column);
  }

  return false;
};

const validateYaml = (doc, schema, file) => {
  file = file || "<unknown>";

  if (doc === undefined) return false;

  if (schema(doc.data)) return true;

  for (const err of schema.errors) {
    const { line, column } = getYamlLocation(doc, err.dataPath);
    report(file, err.message, line, column);
  }

  return false;
};

//
// Schema validation of files.
//

const parseAndValidateJsonFile = async (jsonFile, schemaFile) => {
  const [doc, schema] = await Promise.all([
    fs.readFile(jsonFile, "utf8").then(x => parseJson(x, jsonFile)),
    fs.readFile(schemaFile, "utf8").then(x => parseJsonSchema(x, schemaFile)),
  ]);

  if (doc !== undefined && schema !== undefined) {
    if (validateJson(doc, schema, jsonFile)) return doc;
  }

  return undefined;
};

const parseAndValidateYamlFile = async (yamlFile, schemaFile) => {
  const [doc, schema] = await Promise.all([
    fs.readFile(yamlFile, "utf8").then(x => parseYaml(x, yamlFile)),
    fs.readFile(schemaFile, "utf8").then(x => parseJsonSchema(x, schemaFile)),
  ]);

  if (doc !== undefined && schema !== undefined) {
    if (validateYaml(doc, schema, yamlFile)) return doc;
  }

  return undefined;
};

const validateBibtexFile = async file => {
  const result = await execa(
    "pandoc-citeproc",
    ["--bib2json", "--format=bibtex", file],
    {
      reject: false,
    }
  );

  const pass = !/Error reading bibliography/.test(result.stderr);

  if (result instanceof Error && pass) {
    throw result;
  }

  if (pass) return true;

  const re = /^Error reading bibliography \(line (\d+), column (\d+)\):/;
  const match = result.stderr.match(re);
  const allLines = result.stderr.split("\n").map(x => x.trim());
  const messages = allLines.slice(1);

  let line;
  let column;

  if (match) {
    line = match[1];
    column = match[2];
  }

  if (messages.length === 0) {
    report(file, "error parsing file", line, column);
  } else {
    for (const message of messages) {
      report(file, message, line, column);
    }
  }

  return false;
};

//
// Data validation of specific files.
//

// Limit certain tests because we know that documents past this haven't been
// reviewed and will definitely cause test failures.
const lastReviewedDocument = 500;

const aliasShouldHaveValidRedirects = (alias, documents) => {
  for (const [from, to] of Object.entries(alias.data)) {
    const doc = documents.data.find(x => x.id === to);
    if (doc === undefined) {
      const { line, column } = getYamlLocation(alias, [from]);
      report(paths.alias, `'${to}' not present in documents.yml`, line, column);
    }
  }
};

const documentsShouldHaveUniqueIds = documents => {
  const seen = new Set();

  for (let i = 0; i < documents.data.length; i++) {
    const { id } = documents.data[i];

    if (seen.has(id)) {
      const { line, column } = getYamlLocation(documents, [i]);
      report(paths.documents, `duplicate ID ${id}`, line, column);
    }

    seen.add(id);
  }
};

const authorsShouldBeAccountedFor = (authors, documents) => {
  const seen = new Set();

  const checkAuthor = (author, dataPath) => {
    seen.add(author);

    if (authors.data[author] === undefined) {
      const { line, column } = getYamlLocation(documents, dataPath);
      report(paths.documents, `unknown author '${author}'`, line, column);
    }
  };

  for (let i = 0; i < documents.data.length; i++) {
    const { id, author } = documents.data[i];
    const n = extractDocumentNumber(id);
    if (n > lastReviewedDocument) continue;

    if (typeof author === "string") {
      checkAuthor(author, [i, "author"]);
    } else {
      for (let j = 0; j < author.length; j++) {
        checkAuthor(author[j], [i, "author", j]);
      }
    }
  }
};

//
// Main function.
//

const main = async () => {
  // Running pandoc-citeproc for the 2500 documents is very slow. The index
  // is just a concatenation of the individual documents so we can just check
  // that instead.
  await validateBibtexFile(paths.bibtexIndex);

  // Schema validation.
  const alias = await parseAndValidateYamlFile(
    paths.alias,
    "schema/alias.json"
  );
  const authors = await parseAndValidateYamlFile(
    paths.authors,
    "schema/authors.json"
  );
  const documents = await parseAndValidateYamlFile(
    paths.documents,
    "schema/documents.json"
  );
  await parseAndValidateJsonFile(paths.routes, "schema/routes.json");

  // Data validation.
  aliasShouldHaveValidRedirects(alias, documents);
  documentsShouldHaveUniqueIds(documents);
  authorsShouldBeAccountedFor(authors, documents);
};

main();
