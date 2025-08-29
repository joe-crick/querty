import { cond } from "../src/querty.mjs";

describe("cond helper", () => {
  it("returns value for first matching predicate (functions)", () => {
    const f = cond(
      (x) => x > 10,
      (x) => `big:${x}`,
      (x) => x > 5,
      "mid",
      true,
      "small"
    );
    expect(f(3)).toBe("small");
    expect(f(7)).toBe("mid");
    expect(f(12)).toBe("big:12");
  });

  it("supports 'else' catch-all and returns constant or thunk values", () => {
    const toStr = (x) => `num:${x}`;
    const f = cond(
      (x) => x % 2 === 0,
      toStr,
      "else",
      (x) => `odd:${x}`
    );
    expect(f(2)).toBe("num:2");
    expect(f(3)).toBe("odd:3");
  });

  it("short-circuits and does not evaluate later predicates/exprs", () => {
    const seen = { pred2: 0, expr2: 0 };
    const pred2 = () => {
      seen.pred2 += 1;
      return false;
    };
    const expr2 = () => {
      seen.expr2 += 1;
      return "nope";
    };
    const f = cond(
      () => true,
      () => "first",
      pred2,
      expr2
    );
    expect(f(1)).toBe("first");
    // pred2/expr2 should not have been called
    expect(seen.pred2).toBe(0);
    expect(seen.expr2).toBe(0);
  });

  it("supports legacy array-of-tuples syntax for backward compatibility", () => {
    const f1 = cond([() => false, "no"], [true, "yes"]);
    expect(f1()).toBe("yes");
    const f2 = cond([
      [() => false, "no"],
      [true, () => "ok"]
    ]);
    expect(f2()).toBe("ok");
  });

  it("supports a default/fallback expression when odd-arity provided", () => {
    const f = cond(
      (x) => x > 0,
      () => "pos",
      () => "other"
    );
    expect(f(1)).toBe("pos");
    expect(f(-1)).toBe("other");
  });
});

it("supports Symbol ELSE sentinel for catch-all", () => {
  const f = cond(
    (x) => x === 1,
    () => "one",
    cond.ELSE,
    () => "other"
  );
  expect(f(1)).toBe("one");
  expect(f(2)).toBe("other");
});
