import { nodeProvider } from "querty-node";
import { exec, setConfig } from "../src/querty.mjs";
import simpleAddon from "./test-data/addons/simple-addon.json";

const trivial = {
  isTrivial: false,
  queryParser({ fields, entities, conditions }) {
    const hasTrivial = fields.join("").toLowerCase().includes("trivial");
    this.isTrivial = hasTrivial;
    return {
      fields: hasTrivial ? fields.map((field) => field.replace(/\btrivial\b/gi, "").trim()) : fields,
      entities,
      conditions
    };
  },
  resultSetFilter(resultSet) {
    const vals = Array.isArray(resultSet) ? resultSet : Object.values(resultSet);
    return this.isTrivial
      ? vals.map((item) => {
          item.trivial = true;
          return item;
        })
      : resultSet;
  }
};

const config = {
  apiUrl: "https://jsonplaceholder.typicode.com",
  dataExtractor(data) {
    return data;
  },
  nodeProvider,
  addons: [trivial]
};

describe("addons", () => {
  it("should apply a series of data transforms included as an addon", async () => {
    setConfig(config);
    const state = await exec(
      "SELECT TRIVIAL users.name, title FROM users LEFT JOIN posts ON users.id = posts.userId"
    );
    expect(state).toEqual(simpleAddon);
  });
});
