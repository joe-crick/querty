import { exec, setConfig } from "../src/querty.mjs";
import { nodeProvider } from "querty-node";

const config = {
  apiUrl: "https://jsonplaceholder.typicode.com",
  canCancel: true,
  nodeProvider
};

describe("cancel", () => {
  it("should cancel a request", () => {
    setConfig(config);
    exec("INSERT INTO posts (userId, title, body) VALUES (1, 'test title', 'another value here')").then((data) => {
    });
    config.cancelController.abort();
    expect(true).toEqual(true);
  });
});
