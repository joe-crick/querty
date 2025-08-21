import { trim } from "../src/lib/trim.mjs";
import { intersection } from "../src/lib/intersection.mjs";
import { standardiseEndSlash } from "../src/lib/standardise-end-slash.mjs";
import { isNodejs } from "../src/lib/is-node.mjs";

describe("trim.mjs", () => {
  it("trims leading and trailing whitespace only", () => {
    expect(trim("  hello  ")).toBe("hello");
    expect(trim("\n\thello world\t \n")).toBe("hello world");
    // internal spaces are preserved
    expect(trim(" a  b ")).toBe("a  b");
  });
});

describe("intersection.mjs", () => {
  it("returns the single array when only one provided", () => {
    expect(intersection([1, 2, 3])).toEqual([1, 2, 3]);
  });
  it("computes intersection across multiple arrays", () => {
    expect(intersection([1, 2, 3, 3], [2, 3, 4], [0, 2, 3, 5])).toEqual([2, 3]);
  });
  it("returns empty array when there is no overlap", () => {
    expect(intersection([1], [2], [3])).toEqual([]);
  });
});

describe("standardise-end-slash.mjs", () => {
  it("removes a single trailing slash from non-root urls", () => {
    expect(standardiseEndSlash("https://api/x/")).toBe("https://api/x");
  });
  it("is idempotent and leaves strings without trailing slash unchanged", () => {
    expect(standardiseEndSlash("https://api/x")).toBe("https://api/x");
    expect(standardiseEndSlash("https://api/x")).toBe("https://api/x");
  });
  it("keeps '/' and empty/undefined inputs as-is", () => {
    expect(standardiseEndSlash("/")).toBe("/");
    expect(standardiseEndSlash("")).toBe("");
    expect(standardiseEndSlash(undefined)).toBeUndefined();
  });
});

describe("is-node.mjs", () => {
  it("detects Node.js environment (Jest runs in Node)", () => {
    expect(isNodejs()).toBe(true);
  });
});
