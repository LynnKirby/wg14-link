const fs = require("fs");
const yaml = require("yaml");

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
          `expected ${this.utils.printReceived(received)} not to be contained `+
          `in object ${expectedText}`,
        pass: true,
      };
    } else {
      return {
        message: () =>
          `expected ${this.utils.printReceived(received)} to be contained ` +
          `in object ${expectedText}`,
        pass: false,
      };
    }
  },
});

const dataFileCache = {};

const readDataFile = dataPath => {
  const cached = dataFileCache[dataPath];
  if (cached !== undefined) return cached;

  let data;
  const relDataPath = `../${dataPath}`;

  if (dataPath.endsWith(".yml")) {
    const file = fs.readFileSync(require.resolve(relDataPath), {
      encoding: "utf8",
    });
    data = yaml.parse(file, { schema: "failsafe" });
  } else {
    data = require(relDataPath);
  }

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

describe("data/documents.yml", () => {
  itShouldValidateAgainstSchema("data/documents.yml", "schema/documents.json");
});
