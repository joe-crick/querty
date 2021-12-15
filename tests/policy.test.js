import cloneDeep from "clone-deep";
import { exec, setConfig } from "../src/querty.mjs";

const config = {
  apiUrl: "https://jsonplaceholder.typicode.com",
  dataExtractor(data) {
    return data;
  }
};

describe("policies", () => {
  it("should apply a cockatiel Policy to all requests", async () => {
    const globalPolicyConfig = cloneDeep(config);
    globalPolicyConfig.policy = { execute: jest.fn((item) => item()) };
    setConfig(globalPolicyConfig);
    await exec("INSERT INTO posts (userId, title, body) VALUES (1, 'test title', 'another value here')");

    expect(globalPolicyConfig.policy.execute).toHaveBeenCalled();
  });
  it("should apply a cockatiel Policy to a specific request", async () => {
    const endpointPolicy = cloneDeep(config);
    endpointPolicy.posts = { policy: { execute: jest.fn((item) => item()) } };
    setConfig(endpointPolicy);
    await exec("INSERT INTO posts (userId, title, body) VALUES (1, 'test title', 'another value here')");

    expect(endpointPolicy.posts.policy.execute).toHaveBeenCalled();
  });
});
