import { createReturnStructure } from "../src/lib/create-return-structure.mjs";

function wrap(data) {
  return { data };
}

describe("Result evaluation: HAVING and ORDER BY", () => {
  it("applies HAVING equality after GROUP BY on join results", () => {
    const entities = ["users", "posts"];
    const rawData = [
      wrap([
        { id: 1, name: "A" },
        { id: 2, name: "B" },
        { id: 1, name: "A" }
      ]),
      wrap([
        { userId: 1, title: "t1" },
        { userId: 2, title: "t2" }
      ])
    ];
    const fields = ["users.name", "title"]; // fields selected
    const conditions = {
      join: ["LEFT JOIN"],
      joinCond: [["id", "userId"]],
      groupBy: ["users.name"],
      having: "users.name = 'A'"
    };

    const results = createReturnStructure(rawData, entities, fields, conditions, (x) => x);
    // Join yields rows with keys name and title; groupBy dedupes; having filters only name === 'A'
    expect(Array.isArray(results)).toBe(true);
    expect(results.every((r) => r.name === "A")).toBe(true);
  });

  it("applies ORDER BY on object sets (unscoped field applied to all)", () => {
    const entities = ["users"];
    const rawData = [
      wrap([
        { id: 2, name: "B" },
        { id: 1, name: "A" },
        { id: 3, name: "C" }
      ])
    ];
    const fields = ["id", "name"];
    const conditions = {
      orderBy: [{ field: "name", direction: "DESC" }]
    };
    const results = createReturnStructure(rawData, entities, fields, conditions, (x) => x);
    expect(results.users.map((u) => u.name)).toEqual(["C", "B", "A"]);
  });

  it("applies ORDER BY on join results with mixed directions and scoped fields", () => {
    const entities = ["users", "posts"];
    const rawData = [
      wrap([
        { id: 1, name: "B" },
        { id: 2, name: "A" }
      ]),
      wrap([
        { userId: 1, title: "t2" },
        { userId: 1, title: "t1" },
        { userId: 2, title: "t3" }
      ])
    ];
    const fields = ["users.name", "title"];
    const conditions = {
      join: ["JOIN"],
      joinCond: [["id", "userId"]],
      orderBy: [
        { field: "users.name", direction: "ASC" },
        { field: "title", direction: "DESC" }
      ]
    };

    const results = createReturnStructure(rawData, entities, fields, conditions, (x) => x);
    // Expect sorted first by name ASC (A then B), then by title DESC within same name
    const names = results.map((r) => r.name);
    expect(names.slice(0, 2)).toEqual(["A", "B"].slice(0, 2));
    // For user A (id 2) only one post t3; for user B (id 1) titles should be t2 then t1
    const bRows = results.filter((r) => r.name === "B");
    expect(bRows.map((r) => r.title)).toEqual(["t2", "t1"]);
  });

  it("applies HAVING IN on object sets for scoped entity only", () => {
    const entities = ["users", "posts"];
    const rawData = [
      wrap([
        { id: 1, name: "A" },
        { id: 2, name: "B" },
        { id: 3, name: "C" }
      ]),
      wrap([{ id: 10, title: "x" }])
    ];
    const fields = ["users.name"];
    const conditions = {
      groupBy: ["users.name"],
      having: "users.name IN ('A','C')"
    };
    const results = createReturnStructure(rawData, entities, fields, conditions, (x) => x);
    expect(results.users.map((u) => u.name).sort()).toEqual(["A", "C"]);
    // posts should remain untouched because having targets users
    expect(results.posts).toEqual([{}]);
  });
});
