import { setConfig, exec } from "../src/querty.mjs";
import selectSimpleSubset from "./test-data/select/select-simple-subset.json";
import { nodeProvider } from "querty-node";

const distinct = {
  hasDistinct: false,

  // TODO  Figure out `this` reference - need to bind
  queryParser: ({ fields, entities, conditions }) => {
    this.hasDistinct = false;
    const hasDistinct = fields.join("").toLowerCase().includes("distinct");
    if (hasDistinct) {
      this.hasDistinct = true;
    }
    return {
      fields: hasDistinct ? fields.map((field) => field.replace(/\bdistinct\b/gi, "").trim()) : fields,
      entities,
      conditions
    };
  },
  resultSetFilter(resultSet) {
    if (this.hasDistinct) {
      resultSet.users = resultSet.users.map((item) => {
        item.distinct = true;
        return item;
      });
    }
    return resultSet;
  }
};

const config = {
  apiUrl: "https://jsonplaceholder.typicode.com",
  dataExtractor(data) {
    return data;
  },
  nodeProvider,
  addons: [distinct]
};

describe("addons", () => {
  it("should apply a series of data transforms included as an addon", async () => {
    setConfig(config);
    const state = await exec("SELECT DISTINCT name, email FROM users");
    console.log(state);
    expect(state).toEqual(selectSimpleSubset);
  });
});
