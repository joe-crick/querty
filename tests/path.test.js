import { nodeProvider } from "querty-node";
import { exec, setConfig } from "../src/querty.mjs";

const config = {
  apiUrl: "https://jsonplaceholder.typicode.com",
  nodeProvider,
  path: {
    users: {
      url: "https://gorest.co.in/public/v1"
    }
  },
  dataExtractor(data) {
    return data.hasOwnProperty("data") ? data.data : data;
  }
};

describe("cancel", () => {
  it("should make requests from multiple endpoints", async () => {
    setConfig(config);
    const state = await exec("SELECT users.name, title FROM users LEFT JOIN posts ON users.id = posts.userId");
    expect(state.length).toBeGreaterThan(0);
  });
});
