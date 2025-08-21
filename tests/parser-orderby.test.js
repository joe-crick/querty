import { parseSelect } from "../src/lib/query-parser.mjs";

describe("ORDER BY parsing", () => {
  it("parses ORDER BY single field with default ASC and explicit DESC", () => {
    const q1 = "SELECT name FROM users ORDER BY name";
    const q2 = "SELECT name FROM users ORDER BY name DESC";
    const p1 = parseSelect(q1);
    const p2 = parseSelect(q2);
    expect(p1.conditions.orderBy).toEqual([{ field: "name", direction: "ASC" }]);
    expect(p2.conditions.orderBy).toEqual([{ field: "name", direction: "DESC" }]);
  });

  it("parses ORDER BY multiple fields with mix of directions and entity scope", () => {
    const q = "SELECT users.name, title FROM users, posts ORDER BY users.name ASC, title DESC";
    const p = parseSelect(q);
    expect(p.conditions.orderBy).toEqual([
      { field: "users.name", direction: "ASC" },
      { field: "title", direction: "DESC" }
    ]);
  });
});
