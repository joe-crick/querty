import { setConfig, config } from "../src/lib/config.mjs";

describe("config.mjs - getNestedRoute and dataExtractor", () => {
  afterEach(() => {
    // Reset config between tests
    setConfig({ apiUrl: "", options: {} });
  });

  it("computes nested route by replacing placeholders with conditions", () => {
    setConfig({
      apiUrl: "https://api",
      pathMap: {
        posts: "users/{users.id}/posts/{posts.id}"
      }
    });

    const conditions = { "users.id": 7, "posts.id": 3 };
    const route = config.getNestedRoute("posts", conditions);
    expect(route).toBe("users/7/posts/3");
  });

  it("returns undefined for entities without a pathMap entry", () => {
    setConfig({ apiUrl: "https://api", pathMap: { posts: "users/{users.id}/posts" } });
    const route = config.getNestedRoute("users", { id: 1 });
    expect(route).toBeUndefined();
  });

  it("throws if nested route requested without conditions", () => {
    setConfig({ apiUrl: "https://api", pathMap: { posts: "users/{users.id}/posts" } });
    expect(() => config.getNestedRoute("posts", undefined)).toThrow(
      /You cannot query a nested route without a conditional clause/
    );
  });

  it("uses default dataExtractor when not provided", () => {
    setConfig({ apiUrl: "https://api" });
    // Default extractor returns the input
    expect(config.dataExtractor({ foo: 1 })).toEqual({ foo: 1 });
  });

  it("uses custom dataExtractor when provided", () => {
    setConfig({ apiUrl: "https://api", dataExtractor: (d) => d.data ?? d });
    expect(config.dataExtractor({ data: [1, 2] })).toEqual([1, 2]);
  });
});
