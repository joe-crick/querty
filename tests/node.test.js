import { exec, setConfig } from "../src/querty.mjs";
import createSimple from "./test-data/create/simple-create.json";
import { nodeProvider } from "querty-node";

const config = {
  apiUrl: "https://jsonplaceholder.typicode.com",
  dataExtractor(data) {
    return data;
  },
  nodeProvider
};

describe("node-test", () => {
  it("should use node", async () => {
    setConfig(config);
    const state = await exec("INSERT INTO posts (userId, title, body) VALUES (1, 'test title', 'another value here')");
    expect(state).toEqual(createSimple);
  });
});
