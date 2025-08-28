import { setConfig } from "../src/lib/config.mjs";
import { http } from "../src/lib/http-client/http.mjs";

describe("debug mode with nodeProvider", () => {
  const originalConsoleLog = console.log;

  beforeEach(() => {
    console.log = jest.fn();
  });

  afterEach(() => {
    setConfig({ apiUrl: "", options: {} });
    console.log = originalConsoleLog;
  });

  it("logs request details when using nodeProvider (GET)", async () => {
    const nodeProvider = jest.fn().mockResolvedValue({ status: 200, data: { ok: true } });
    setConfig({ apiUrl: "https://api", options: {}, debug: true, nodeProvider });

    await http.get("users");

    // Ensure provider was called
    expect(nodeProvider).toHaveBeenCalledTimes(1);

    // Ensure a single debug log fired from node path
    expect(console.log).toHaveBeenCalledTimes(1);
    const [prefix, payload] = console.log.mock.calls[0];
    expect(prefix).toBe("[querty][debug] api request:");
    expect(payload.url).toBe("https://api/users");
    expect(payload.options).toEqual({ method: "GET" });
  });

  it("includes stringified body for POST via nodeProvider", async () => {
    const nodeProvider = jest.fn().mockImplementation(async (opts) => {
      // Simulate fetch-like return
      return { status: 201, data: { id: 1 } };
    });
    setConfig({ apiUrl: "https://api", options: { headers: { "Content-Type": "application/json" } }, debug: true, nodeProvider });

    await http.post("posts", { title: "t" });

    expect(console.log).toHaveBeenCalledTimes(1);
    const [, payload] = console.log.mock.calls[0];
    expect(payload.url).toBe("https://api/posts");
    expect(payload.options).toEqual({ method: "POST", body: JSON.stringify({ title: "t" }), headers: { "Content-Type": "application/json" } });
  });
});
