import { exec, setConfig } from "../src/querty.mjs";
import createSimple from "./test-data/create/simple-create.json";

const config = {
  apiUrl: "https://jsonplaceholder.typicode.com",
  dataExtractor(data) {
    return data;
  }
};

describe("create", () => {
  it("should create an entity on an endpoint with SQL syntax", async () => {
    setConfig(config);
    const state = await exec("INSERT INTO posts (userId, title, body) VALUES (1, 'test title', 'another value here')");
    expect(state).toEqual(createSimple);
  });
  it("should create an entity on an endpoint with data", async () => {
    setConfig(config);
    const state = await exec("INSERT INTO posts", { userId: 1, title: "test title", body: "another value here" });
    expect(state).toEqual(createSimple);
  });
});
