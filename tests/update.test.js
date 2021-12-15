import { exec, setConfig } from "../src/querty.mjs";
import updateSimple from "./test-data/update/simple-update.json";
import { nodeProvider } from "querty-node";

const config = {
  apiUrl: "https://jsonplaceholder.typicode.com",
  dataExtractor(data) {
    return data;
  },
  nodeProvider
};

describe("update", () => {
  it("should update data on an endpoint with SQL syntax", async () => {
    setConfig(config);
    const state = await exec(`UPDATE posts SET title = 'Alfred Schmidt', body = 'Frankfurt' WHERE id = 1`);
    expect(state).toEqual(updateSimple);
  });
  it("should update data on an endpoint with data", async () => {
    setConfig(config);
    const state = await exec(`UPDATE posts WHERE id = 1`, { id: 1, title: "Alfred Schmidt", body: "Frankfurt" });
    expect(state).toEqual(updateSimple);
  });
});
