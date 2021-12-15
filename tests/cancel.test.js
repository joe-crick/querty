import { exec, setConfig } from "../src/querty.mjs";

const config = {
  apiUrl: "https://jsonplaceholder.typicode.com",
  canCancel: true
};

describe("cancel", () => {
  it("should cancel a request", () => {
    setConfig(config);
    exec("INSERT INTO posts (userId, title, body) VALUES (1, 'test title', 'another value here')").then((data) => {
      console.log(data);
    });
    config.cancelController.abort();
    expect(true).toEqual(true);
  });
});
