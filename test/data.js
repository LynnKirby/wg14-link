const { parseDataFileSync } = require("../util");
const path = require("path");

//
// Matchers
//

expect.extend(require("jest-json-schema").matchers);

expect.extend({
  toBeContainedInObject(received, ...argument) {
    const expected = argument[0];
    const objectName = argument[1];

    const expectedText = objectName
      ? this.utils.EXPECTED_COLOR(objectName)
      : this.utils.printExpected(expected);

    const pass = this.equals(
      expected,
      expect.arrayContaining([expect.objectContaining(received)])
    );

    if (pass) {
      return {
        message: () =>
          `expected ${this.utils.printReceived(received)} not to be ` +
          `contained in object ${expectedText}`,
        pass: true,
      };
    } else {
      return {
        message: () =>
          `expected ${this.utils.printReceived(received)} to be ` +
          `contained in object ${expectedText}`,
        pass: false,
      };
    }
  },
});

//
// Utilities.
//

const dataFileCache = {};

const readDataFile = dataPath => {
  const cached = dataFileCache[dataPath];
  if (cached !== undefined) return cached;

  const relDataPath = path.join(__dirname, "../", dataPath);
  const data = parseDataFileSync(relDataPath);
  dataFileCache[dataPath] = data;
  return data;
};

const itShouldValidateAgainstSchema = (dataPath, schemaPath) => {
  it("should validate against schema", () => {
    const schema = require(`../${schemaPath}`);
    const data = readDataFile(dataPath);
    expect(data).toMatchSchema(schema);
  });
};

//
// Tests.
//

// Limits certain tests because we know that documents past that haven't been
// reviewed and will definitely cause test failures.
const lastReviewedDocument = 500;

describe("build/redirect.json", () => {
  itShouldValidateAgainstSchema("build/redirect.json", "schema/redirect.json");
});

describe("data/alias.yml", () => {
  const alias = readDataFile("data/alias.yml");
  const docs = readDataFile("data/documents.yml");

  itShouldValidateAgainstSchema("data/alias.yml", "schema/alias.json");

  it("should redirect to existing document ID", () => {
    for (let id of Object.values(alias)) {
      expect({ id }).toBeContainedInObject(docs, "data/documents.yml");
    }
  });
});

describe("data/authors.yml", () => {
  itShouldValidateAgainstSchema("data/authors.yml", "schema/authors.json");
});

describe("data/documents.yml", () => {
  const authors = readDataFile("data/authors.yml");
  const docs = readDataFile("data/documents.yml");

  itShouldValidateAgainstSchema("data/documents.yml", "schema/documents.json");

  it("has unique IDs", () => {
    const seen = new Set();
    const duplicates = new Set();

    for (let { id } of docs) {
      if (seen.has(id)) {
        duplicates.add(id);
      }
      seen.add(id);
    }

    expect(Array.from(duplicates)).toEqual([]);
  });

  // Note this test also validates authors.yml
  it("has a 1:1 mapping to authors in authors.yml", () => {
    const allAuthors = new Set();

    for (let { id, author } of docs) {
      const n = Number.parseInt(id.substring(1), 10);
      if (n > lastReviewedDocument) continue;

      if (typeof author === "string") {
        allAuthors.add(author);
      } else {
        author.forEach(x => allAuthors.add(x));
      }
    }

    expect(Array.from(allAuthors).sort()).toEqual(Object.keys(authors).sort());
  });
});
