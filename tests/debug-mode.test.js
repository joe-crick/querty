import { setConfig } from "../src/lib/config.mjs";
import { http } from "../src/lib/http-client/http.mjs";

// Helper to mock fetch response
function mockFetchResponse(data = {}, status = 200) {
  global.fetch = jest.fn().mockResolvedValue({
    status,
    json: async () => data
  });
}

describe("debug mode logging", () => {
  const originalConsoleLog = console.log;

  beforeEach(() => {
    // fresh console spy and fetch mock per test
    console.log = jest.fn();
  });

  afterEach(() => {
    // Reset config between tests and restore console
    setConfig({ apiUrl: "", options: {} });
    console.log = originalConsoleLog;
    if (global.fetch && jest.isMockFunction(global.fetch)) {
      global.fetch.mockRestore?.();
    }
  });

  it("logs request details when debug is enabled (no signal)", async () => {
    setConfig({ apiUrl: "https://api", options: {}, debug: true });
    mockFetchResponse({ ok: true });

    await http.get("users");

    expect(console.log).toHaveBeenCalledTimes(1);
    const [prefix, payload] = console.log.mock.calls[0];
    expect(prefix).toBe("[querty][debug] api request:");
    expect(payload).toBeTruthy();
    expect(payload.url).toBe("https://api/users");
    expect(payload.options).toEqual({ method: "GET" });
  });

  it("does not log when debug is disabled", async () => {
    setConfig({ apiUrl: "https://api", options: {}, debug: false });
    mockFetchResponse({ ok: true });

    await http.get("users");

    expect(console.log).not.toHaveBeenCalled();
  });

  it("redacts AbortSignal in logs when canCancel is true", async () => {
    setConfig({ apiUrl: "https://api", options: {}, debug: true, canCancel: true });
    mockFetchResponse({ ok: true });

    await http.post("posts", { title: "t" });

    expect(console.log).toHaveBeenCalledTimes(1);
    const [prefix, payload] = console.log.mock.calls[0];
    expect(prefix).toBe("[querty][debug] api request:");
    expect(payload.url).toBe("https://api/posts");
    // Body should be present for POST and signal should be redacted
    expect(payload.options).toMatchObject({ method: "POST", signal: "[AbortSignal]" });
    // headers are only present if provided in config.options
    // body is stringified in fetch options; the debug options mirror fetchOptions processing in code, so not included when GET

    // Ensure the actual fetch received a real signal (not the string)
    const fetchCallOptions = global.fetch.mock.calls[0][1];
    expect(fetchCallOptions.signal).toBeInstanceOf(AbortSignal);
  });
});
