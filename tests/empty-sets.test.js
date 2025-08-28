import { createReturnStructure } from "../src/lib/create-return-structure.mjs";

/**
 * This suite ensures that when an entity returns an empty set, the
 * return structure uses an empty array ([]) rather than undefined.
 */

describe("createReturnStructure - empty sets", () => {
  it("returns empty array for single-entity empty result", () => {
    const rawData = [{ data: [] }];
    const entities = ["users"];
    const fields = ["id", "name"]; // arbitrary fields

    const result = createReturnStructure(rawData, entities, fields, {});

    expect(result).toEqual({ users: [] });
  });

  it("returns empty array for one entity and preserves others", () => {
    const rawData = [
      { data: [] },
      {
        data: [
          { id: 1, title: "a" },
          { id: 2, title: "b" }
        ]
      }
    ];
    const entities = ["users", "posts"];
    const fields = ["users.id", "users.name", "posts.title"]; // mix of scoped fields

    const result = createReturnStructure(rawData, entities, fields, {});

    expect(result.users).toEqual([]);
    expect(Array.isArray(result.posts)).toBe(true);
    // Only requested field from posts (title) should be present
    expect(result.posts).toEqual([{ title: "a" }, { title: "b" }]);
  });
});
