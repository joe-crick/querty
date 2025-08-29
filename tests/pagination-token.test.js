import { setConfig } from "../src/lib/config.mjs";
import { http } from "../src/lib/http-client/http.mjs";

// Utilities
function createHeaders(map = {}) {
  return {
    get: (k) => map[k.toLowerCase?.() ? k.toLowerCase() : k] || map[k] || undefined
  };
}

function mockFetchResponseSequence(responses) {
  // responses: array of { status, data, headers }
  global.fetch = jest.fn().mockImplementation(async () => {
    const next = responses.shift() || { status: 200, data: {} };
    return {
      status: next.status ?? 200,
      json: async () => next.data,
      headers: next.headers || { get: () => undefined }
    };
  });
}

describe("pagination token support - web fetch", () => {
  afterEach(() => {
    setConfig({ apiUrl: "", options: {} });
    if (global.fetch && jest.isMockFunction(global.fetch)) {
      global.fetch.mockRestore?.();
    }
  });

  it("appends next token on subsequent GET and clears state returning [] when no next token (responsePath)", async () => {
    setConfig({
      apiUrl: "https://api",
      options: {},
      // Extract items, so return value is an array for happy-path
      dataExtractor: (d) => d.items,
      paginationToken: {
        param: "cursor",
        responsePath: "next"
      }
    });

    // First response provides a next token in body; second has no token
    mockFetchResponseSequence([
      { status: 200, data: { items: [1, 2], next: "tok-1" }, headers: createHeaders() },
      { status: 200, data: { items: [3], next: undefined }, headers: createHeaders() }
    ]);

    // First call (no token yet)
    let res = await http.get("users", { limit: 2 });
    expect(res.status).toBe(200);
    expect(res.data).toEqual([1, 2]);
    // URL should not include cursor on first call
    const firstUrl = global.fetch.mock.calls[0][0];
    expect(firstUrl).toBe("https://api/users?limit=2");

    // Second call (should include cursor)
    res = await http.get("users", { limit: 2 });
    expect(res.status).toBe(200);
    // Because there was an active pagination and now no next token, data must be []
    expect(res.data).toEqual([]);
    const secondUrl = global.fetch.mock.calls[1][0];
    // Query must include the cursor value from first response
    expect(secondUrl).toBe("https://api/users?limit=2&cursor=tok-1");
  });

  it("supports extracting token from response header", async () => {
    setConfig({
      apiUrl: "https://api",
      options: {},
      dataExtractor: (d) => d.items,
      paginationToken: {
        param: "pageToken",
        responseHeader: "x-next-token"
      }
    });

    mockFetchResponseSequence([
      { status: 200, data: { items: [10] }, headers: { get: (k) => (k === "x-next-token" ? "hdr-123" : undefined) } },
      { status: 200, data: { items: [20] }, headers: { get: () => undefined } }
    ]);

    await http.get("things", { category: "a" });
    const firstUrl = global.fetch.mock.calls[0][0];
    expect(firstUrl).toBe("https://api/things?category=a");

    const r2 = await http.get("things", { category: "a" });
    const secondUrl = global.fetch.mock.calls[1][0];
    expect(secondUrl).toBe("https://api/things?category=a&pageToken=hdr-123");
    // End of pages -> []
    expect(r2.data).toEqual([]);
  });
});

describe("pagination token support - node provider", () => {
  afterEach(() => {
    setConfig({ apiUrl: "", options: {} });
  });

  it("passes stored token on subsequent call and returns [] when no next token (provider)", async () => {
    const calls = [];
    const provider = jest.fn(async (opts) => {
      // record URL used for verification
      calls.push(opts.url);
      if (calls.length === 1) {
        // first call returns next token in body
        return { status: 200, data: { items: [1], next: "NP-1" } };
      }
      // second call: no next token
      return { status: 200, data: { items: [2] } };
    });

    setConfig({
      apiUrl: "https://api",
      options: {},
      nodeProvider: provider,
      // responsePath will be used against raw body (provider path uses raw data for extraction)
      paginationToken: { param: "cursor", responsePath: "next" }
    });

    let r1 = await http.get("entries", { q: "x" });
    expect(r1.status).toBe(200);
    // In node path, wrapper returns raw extractedData; for first call it's the raw object
    expect(r1.data).toEqual({ items: [1], next: "NP-1" });
    expect(calls[0]).toBe("https://api/entries?q=x");

    const r2 = await http.get("entries", { q: "x" });
    expect(calls[1]).toBe("https://api/entries?q=x&cursor=NP-1");
    // End of pagination -> []
    expect(r2.data).toEqual([]);
  });
});
