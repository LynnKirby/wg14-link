// usage: ava --tap | node avatap2gh.js
//
// Converts TAP output from AVA into commands understood by the GitHub CI
// runner. It adds annotations to, for example, pull requests on test failure.

const Parser = require("tap-parser");
const process = require("process");

const p = new Parser();

p.on("fail", assert => {
  if (!assert.diag) return;

  // AVA errors have the position directly: `foo.js:1:1`
  // Thrown errors are wrapped: `Some location (foo.js:1:1)`
  const re = assert.diag.values
    ? /^([^:]+):(\d+):(\d+)$/
    : /\(([^:]+):(\d+):(\d+)\)$/;

  const match = assert.diag.at.match(re);
  if (!match) return;

  let [_, file, line, column] = match;

  // Escape the file property.
  file = file
    .replace(/%/g, "%25")
    .replace(/\r/g, "%0D")
    .replace(/\n/g, "%0A")
    .replace(/:/g, "%3A")
    .replace(/,/g, "%2C");

  let message = "";

  // Try to construct a message from an AVA assertion.
  if (assert.diag.values) {
    const valuesMessage = Object.entries(assert.diag.values)
      .map(x => {
        return `${x[0]}\n${x[1]}`;
      })
      .join("\n\n");
    message = `${assert.name}\n\n${valuesMessage}`;
  } else if (assert.diag.message) {
    message = assert.diag.message;
  }

  // Escape command data.
  message = message
    .replace(/%/g, "%25")
    .replace(/\r/g, "%0D")
    .replace(/\n/g, "%0A");

  console.log(`::error file=${file},line=${line},column=${column}::${message}`);
});

process.stdin.pipe(p);
process.stdin.pipe(process.stdout);
