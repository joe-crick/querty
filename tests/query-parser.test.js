import { parseSelect, parseInsert, parseUpdate } from "../src/lib/query-parser.mjs";

describe("query-parser.parseSelect", () => {
  it("parses a simple SELECT without WHERE or JOIN", () => {
    const q = "SELECT name, email FROM users";
    const parsed = parseSelect(q);
    expect(parsed).toEqual({
      entities: ["users"],
      fields: ["name", "email"]
    });
  });

  it("parses a multi-entity SELECT without JOIN (object sets)", () => {
    const q = "SELECT users.name, title FROM users, posts";
    const parsed = parseSelect(q);
    expect(parsed).toEqual({
      entities: ["users", "posts"],
      fields: ["users.name", "title"]
    });
  });

  it("parses a SELECT with a simple WHERE clause (unscoped field)", () => {
    const q = "SELECT name FROM users WHERE id = 1";
    const parsed = parseSelect(q);
    expect(parsed.entities).toEqual(["users"]);
    expect(parsed.fields).toEqual(["name"]);
    expect(parsed.conditions).toBeDefined();
    expect(parsed.conditions).toMatchObject({ id: "1", value: "1" });
  });

  it("parses a SELECT with a simple WHERE clause (entity-scoped field)", () => {
    const q = "SELECT users.name FROM users WHERE users.id = 5";
    const parsed = parseSelect(q);
    expect(parsed.entities).toEqual(["users"]);
    expect(parsed.fields).toEqual(["users.name"]);
    expect(parsed.conditions).toBeDefined();
    expect(parsed.conditions).toMatchObject({ "users.id": "5", value: "5" });
  });

  it("parses INNER JOIN with ON and extracts joinCond", () => {
    const q = "SELECT users.name, title FROM users JOIN posts ON users.id = posts.userId";
    const parsed = parseSelect(q);
    expect(parsed.entities).toEqual(["users", "posts"]);
    expect(parsed.fields).toEqual(["users.name", "title"]);
    expect(parsed.conditions).toBeDefined();
    expect(parsed.conditions.join).toBeDefined();
    // joinCond keeps only property names on each side of the ON
    expect(parsed.conditions.joinCond).toEqual([["id", "userId"]]);
  });

  it("parses LEFT JOIN and FULL JOIN with multiple joins", () => {
    const q =
      "SELECT users.name, posts.title FROM users LEFT JOIN posts ON users.id = posts.userId FULL JOIN todos ON users.id = todos.userId";
    const parsed = parseSelect(q);
    expect(parsed.entities).toEqual(["users", "posts", "todos"]);
    expect(parsed.fields).toEqual(["users.name", "posts.title"]);
    expect(parsed.conditions).toBeDefined();
    expect(parsed.conditions.join).toBeDefined();
    expect(parsed.conditions.join.length).toBeGreaterThan(0);
    expect(parsed.conditions.joinCond).toEqual([
      ["id", "userId"],
      ["id", "userId"]
    ]);
  });

  it("parses GROUP BY with unscoped fields (no WHERE)", () => {
    const q = "SELECT name, email FROM users GROUP BY name";
    const parsed = parseSelect(q);
    expect(parsed.entities).toEqual(["users"]);
    expect(parsed.fields).toEqual(["name", "email"]);
    expect(parsed.conditions).toBeDefined();
    expect(parsed.conditions.groupBy).toEqual(["name"]);
    // No where value should be present beyond default value prop which is undefined when no WHERE
    expect(parsed.conditions.value).toBeUndefined();
  });

  it("parses GROUP BY with entity-scoped fields alongside JOIN", () => {
    const q =
      "SELECT users.name, title FROM users LEFT JOIN posts ON users.id = posts.userId GROUP BY users.name, title";
    const parsed = parseSelect(q);
    expect(parsed.entities).toEqual(["users", "posts"]);
    expect(parsed.fields).toEqual(["users.name", "title"]);
    expect(parsed.conditions).toBeDefined();
    expect(parsed.conditions.joinCond).toEqual([["id", "userId"]]);
    expect(parsed.conditions.groupBy).toEqual(["users.name", "title"]);
  });

  it("parses HAVING after GROUP BY", () => {
    const q = "SELECT name FROM users GROUP BY name HAVING name = 'Joe'";
    const parsed = parseSelect(q);
    expect(parsed.entities).toEqual(["users"]);
    expect(parsed.fields).toEqual(["name"]);
    expect(parsed.conditions.groupBy).toEqual(["name"]);
    expect(parsed.conditions.having).toBe("name = 'Joe'");
  });

  it("parses HAVING across lines with JOIN and GROUP BY", () => {
    const q = [
      "SELECT users.name, title",
      "FROM users LEFT JOIN posts ON users.id = posts.userId",
      "GROUP BY users.name, title",
      "HAVING COUNT(*) > 1"
    ].join("\n");
    const parsed = parseSelect(q);
    expect(parsed.entities).toEqual(["users", "posts"]);
    expect(parsed.fields).toEqual(["users.name", "title"]);
    expect(parsed.conditions.groupBy).toEqual(["users.name", "title"]);
    expect(parsed.conditions.having).toBe("COUNT(*) > 1");
  });

  it("parses HAVING without GROUP BY (treated as raw string)", () => {
    const q = "SELECT name FROM users HAVING name = 'A'";
    const parsed = parseSelect(q);
    expect(parsed.entities).toEqual(["users"]);
    expect(parsed.fields).toEqual(["name"]);
    expect(parsed.conditions.having).toBe("name = 'A'");
  });
});

describe("query-parser.parseInsert", () => {
  it("parses INSERT with values, including quoted strings", () => {
    const q = "INSERT INTO posts (userId, title, body) VALUES (1, 'test title', 'another value here')";
    const parsed = parseInsert(q);
    expect(parsed.entity).toBe("posts");
    expect(parsed.data).toEqual({ userId: 1, title: "test title", body: "another value here" });
  });
});

describe("query-parser.parseUpdate", () => {
  it("parses UPDATE with SET fields and WHERE id", () => {
    const q = "UPDATE posts SET title = 'Alfred Schmidt', body = 'Frankfurt' WHERE id = 1";
    const parsed = parseUpdate(q);
    expect(parsed.entity).toBe("posts");
    expect(parsed.id).toBe("1");
    expect(parsed.data).toEqual({ title: "Alfred Schmidt", body: "Frankfurt" });
  });
});

// Additional whitespace robustness tests
it("parses SELECT with irregular whitespace and newlines", () => {
  const q = "SELECT   name ,   email \n  FROM\n   users   \n   WHERE   id   =   7  ";
  const parsed = parseSelect(q);
  expect(parsed).toEqual({
    entities: ["users"],
    fields: ["name", "email"],
    conditions: { id: "7", value: "7" }
  });
});

it("parses SELECT with JOIN and GROUP BY across lines", () => {
  const q = [
    "SELECT users.name,  title",
    "FROM  users  LEFT   JOIN   posts   ON users.id = posts.userId",
    "GROUP   BY   users.name , title"
  ].join("\n");
  const parsed = parseSelect(q);
  expect(parsed.entities).toEqual(["users", "posts"]);
  expect(parsed.fields).toEqual(["users.name", "title"]);
  expect(parsed.conditions.joinCond).toEqual([["id", "userId"]]);
  expect(parsed.conditions.groupBy).toEqual(["users.name", "title"]);
});

// IN operator parsing tests
it("parses WHERE id IN (1, 2, 3)", () => {
  const q = "SELECT name FROM users WHERE id IN (1, 2, 3)";
  const parsed = parseSelect(q);
  expect(parsed.entities).toEqual(["users"]);
  expect(parsed.fields).toEqual(["name"]);
  expect(parsed.conditions).toBeDefined();
  expect(parsed.conditions.operator).toBe("IN");
  expect(parsed.conditions.values).toEqual([1, 2, 3]);
  expect(parsed.conditions.value).toBeUndefined();
  expect(parsed.conditions["id"]).toEqual([1, 2, 3]);
});

it("parses WHERE users.id IN ('1','2','3') with JOIN unaffected", () => {
  const q = [
    "SELECT users.name, title",
    "FROM users JOIN posts ON users.id = posts.userId",
    "WHERE users.id IN ('1','2','3')"
  ].join(" ");
  const parsed = parseSelect(q);
  expect(parsed.entities).toEqual(["users", "posts"]);
  expect(parsed.fields).toEqual(["users.name", "title"]);
  expect(parsed.conditions.joinCond).toEqual([["id", "userId"]]);
  expect(parsed.conditions.operator).toBe("IN");
  expect(parsed.conditions.values).toEqual(["1", "2", "3"]);
  expect(parsed.conditions["users.id"]).toEqual(["1", "2", "3"]);
});

it("parses WHERE name IN ('Alice', 'Bob') with whitespace and newlines", () => {
  const q = ["SELECT name", "FROM users", "WHERE   name   IN   (  'Alice' ,  'Bob'  )"].join("\n");
  const parsed = parseSelect(q);
  expect(parsed.entities).toEqual(["users"]);
  expect(parsed.fields).toEqual(["name"]);
  expect(parsed.conditions.operator).toBe("IN");
  expect(parsed.conditions.values).toEqual(["Alice", "Bob"]);
  expect(parsed.conditions.name).toEqual(["Alice", "Bob"]);
});
