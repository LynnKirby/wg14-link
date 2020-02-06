const fs = require("fs");
const yaml = require("yaml");

expect.extend(require("jest-json-schema").matchers);

const schemaTest = (schemaName, dataPath) => {
  test(dataPath, () => {
    let data;
    const relDataPath = `../${dataPath}`;
    const schema = require(`../schema/${schemaName}.json`);

    if (dataPath.endsWith(".yml")) {
      const file = fs.readFileSync(require.resolve(relDataPath), {
        "encoding": "utf8"
      });
      data = yaml.parse(file, { schema: "failsafe" });
    } else {
      data = require(relDataPath);
    }

    expect(data).toMatchSchema(schema);
  });
};

describe("schema validation", () => {
  schemaTest("alias", "data/alias.yml");
  schemaTest("documents", "data/documents.yml");
  schemaTest("redirect", "build/redirect.json");
});
