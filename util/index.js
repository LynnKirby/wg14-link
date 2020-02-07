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
