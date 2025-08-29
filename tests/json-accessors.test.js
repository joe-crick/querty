import { createReturnStructure } from "../src/lib/create-return-structure.mjs";

function wrap(data) {
  return { data };
}

describe("Postgres-style JSON accessors in SELECT fields", () => {
  it("evaluates -> and ->> with aliases on single entity", () => {
    const entities = ["your_table"];
    const rawData = [
      wrap([
        {
          id: 1,
          json_data: {
            property1: 42,
            nested_property: {
              sub_property: "hello"
            }
          }
        }
      ])
    ];
    const fields = [
      "json_data->'property1' as property1",
      "json_data->'nested_property'->>'sub_property' as sub_property"
    ];
    const conditions = {};

    const results = createReturnStructure(rawData, entities, fields, conditions, (x) => x);
    expect(results.your_table).toHaveLength(1);
    const row = results.your_table[0];
    expect(row.property1).toEqual(42); // -> returns JSON value (number)
    expect(row.sub_property).toEqual("hello"); // ->> returns text
  });

  it("infers alias from last key when AS is not provided", () => {
    const entities = ["items"];
    const rawData = [
      wrap([
        {
          id: 1,
          json: { a: { b: "x" } }
        }
      ])
    ];
    const fields = ["json->'a'->>'b'"]; // should infer alias 'b'
    const results = createReturnStructure(rawData, entities, fields, undefined, (x) => x);
    expect(results.items[0]).toHaveProperty("b", "x");
  });

  it("works with entity-scoped field prefix (users.json->>'name')", () => {
    const entities = ["users"];
    const rawData = [
      wrap([
        { id: 1, json: { name: "Neo" } },
        { id: 2, json: { name: "Trinity" } }
      ])
    ];
    const fields = ["users.json->>'name' as name"]; // entity scope should be removed
    const results = createReturnStructure(rawData, entities, fields, undefined, (x) => x);
    expect(results.users.map((u) => u.name)).toEqual(["Neo", "Trinity"]);
  });

  it("returns null for missing paths and supports array indexing", () => {
    const entities = ["tbl"];
    const rawData = [
      wrap([{ json: { a: [10, 20, 30] } }, { json: {} }])
    ];
    const fields = ["json->'a'->>'1' as second", "json->'a'->'9' as outOfRange"]; // index 1 -> 20, index 9 missing -> null
    const r = createReturnStructure(rawData, entities, fields, undefined, (x) => x);
    expect(r.tbl[0].second).toBe("20");
    expect(r.tbl[0].outOfRange).toBeNull();
    expect(r.tbl[1].second).toBeNull();
    expect(r.tbl[1].outOfRange).toBeNull();
  });
});
