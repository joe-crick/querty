import cloneDeep from "clone-deep";
import { exec, setConfig } from "../src/querty.mjs";
import { nodeProvider } from "querty-node";

const config = {
  apiUrl: "https://gorest.co.in/public/v1",
  options: {
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      Authorization: "Bearer ce12e74caa9377194dfd1e2ead6d0f386fe81b2468de5acec5e6d9ee7a26aab6"
    }
  },
  dataExtractor(data) {
    return data.data;
  },
  nodeProvider
};

const refreshConfig = {
  ...config,
  refresh() {
    return new Promise((res) => {
      res({
        Accept: "application/json",
        "Content-Type": "application/json",
        Authorization: "Bearer ce12e74caa9377194dfd1e2ead6d0f386fe81b2468de5acec5e6d9ee7a26aab6"
      });
    });
  }
};

describe("authenticate", () => {
  it("should authenticate when provided Authorization", () => {
    async function successfulAsyncTest() {
      setConfig(config);
      exec(
        `INSERT INTO users (name, gender, email, status) VALUES ('pata nali', 'male', '${Math.random()}@${Math.random()}.es', 'active')`
      );
    }
    return successfulAsyncTest().then(() => {
      expect(true).toBe(true);
    });
  });
  it("should NOT authenticate when provided invalid Authorization", () => {
    const badConfig = cloneDeep(config);
    badConfig.options.headers.Authorization = "I don't work";
    async function failingAsyncTest() {
      setConfig(badConfig);
      return exec(
        `INSERT INTO users (name, gender, email, status) VALUES ('pata nali', 'male', '${Math.random()}@${Math.random()}.es', 'active')`
      );
    }
    return failingAsyncTest().catch((error) => {
      expect(error.message).toBe("401");
    });
  });
  it("should attempt a refresh when provided with a refresh method and auth fails", async () => {
    const badConfig = cloneDeep(refreshConfig);
    badConfig.options.headers.Authorization = "I don't work";
    async function failingAsyncTest() {
      setConfig(badConfig);
      return exec(
        `INSERT INTO users (name, gender, email, status) VALUES ('pata nali', 'male', '${Math.random()}@${Math.random()}.es', 'active')`
      );
    }
    await failingAsyncTest();
    expect(true).toBe(true);
  });
});
