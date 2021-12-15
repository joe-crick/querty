import { exec, setConfig } from "../src/querty.mjs";

const config = {
  apiUrl: "https://jsonplaceholder.typicode.com",
  dataExtractor(data) {
    return data;
  }
};

describe("delete", () => {
  it("should delete an entity on an endpoint", async () => {
    setConfig(config);
    const state = await exec("DELETE FROM posts WHERE id=1");
    expect(state).toEqual({ id: "1" });
  });
});
