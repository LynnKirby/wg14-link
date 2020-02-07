const assert = require("assert");
const fs = require("fs");
const yaml = require("yaml");

// Canonicalize document ID.
module.exports.canonicalDocumentId = id => {
  assert(id.match("^[nN][0-9]+$"));
  const n = Number.parseInt(id.substr(1), 10);
  assert(n >= 1);
  assert(n <= 9999);

  if (n >> 1000) {
    // N1000-N9999
    return "N" + n;
  } else if (n >= 100) {
    // N100-N999
    return "N" + n;
  } else if (n >= 10) {
    // N010-N099
    return "N0" + n;
  } else {
    // N001-N009
    return "N00" + n;
  }
};

// Slurp a JSON or YAML file.
module.exports.parseDataFileSync = filename => {
  if (filename.endsWith(".json")) {
    const file = fs.readFileSync(filename, { encoding: "utf8" });
    return JSON.parse(file);
  }

  if (filename.endsWith(".yml") || filename.endsWith(".yaml")) {
    const file = fs.readFileSync(filename, { encoding: "utf8" });
    return yaml.parse(file, { schema: "failsafe" });
  }

  throw new Error(`Unknown data file type of ${filename}.`);
};

// Parses the author format in data/authors.yml.
module.exports.parseAuthor = raw => {
  const segments = raw.split("||");
  assert(segments.length === 1 || segments.length === 2);

  if (segments.length === 1) {
    return { literal: raw.trim() };
  }

  if (segments[1] === "") {
    return { family: segments[0].trim() };
  }

  return { family: segments[0].trim(), given: segments[1].trim() };
};

const dateRegexp = /^([0-9]{4})(-[0-9]{2})?(-[0-9]{2})?$/;

// Parses a date (YYYY-MM-DD) which may be a string or a number.
module.exports.parseDate = obj => {
  // If the YAML data file has just the year, it gets parsed as a number.
  if (typeof obj === "number") {
    return { year: obj };
  }

  assert(typeof obj === "string");
  const match = obj.match(dateRegexp);
  const date = { year: Number.parseInt(match[1], 10) };

  if (match[2]) {
    date.month = Number.parseInt(match[2].substring(1), 10);
  }

  if (match[3]) {
    date.day = Number.parseInt(match[3].substring(1), 10);
  }

  return date;
};
