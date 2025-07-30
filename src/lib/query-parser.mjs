import { trim } from "./trim.mjs";
import pkg from "node-sql-parser";
const { Parser } = pkg;

// Initialize the SQL parser
const parser = new Parser();
const opt = {
  database: "MySQL" // Default database type
};

export function parseSelect(query) {
  try {
    const ast = parser.astify(query, opt);

    if (ast.type !== "select") {
      throw new Error("Not a SELECT query");
    }

    // Extract fields
    const fields = extractFields(ast);

    // Extract tables/entities
    const entities = extractEntities(ast);

    // Handle WHERE conditions
    let conditions = handleWhereConditions(ast);

    // Handle JOIN conditions
    const joinResult = handleJoinConditions(ast, conditions);
    conditions = joinResult.conditions;

    return {
      entities: entities,
      fields: fields,
      ...(Object.keys(conditions).length > 0 ? { conditions } : {})
    };
  } catch (error) {
    // Fallback to original behavior for unsupported queries
    return handleFallbackParsing(query, error);
  }
}

export function parseInsert(query) {
  try {
    const ast = parser.astify(query, opt);

    if (ast.type !== "insert") {
      throw new Error("Not an INSERT query");
    }

    const entity = ast.table[0].table;
    const fields = ast.columns || [];
    const values = ast.values?.[0].value || [];

    // Convert values to proper format
    const processedValues = values.map((val) => {
      if (val.type === "string") {
        return val.value;
      } else if (val.type === "number") {
        return val.value;
      } else {
        return val.value?.toString();
      }
    });

    // Create data object
    const data = fields.reduce((acc, cur, index) => {
      acc[cur] = processedValues[index];
      return acc;
    }, {});

    return {
      entity,
      data
    };
  } catch (error) {
    // Fallback to original behavior for unsupported queries
    console.warn(`SQL parsing error: ${error.message}. Using fallback parser.`);

    const matches = query.split(/INSERT INTO \b(\w+)\b|\bVALUES\b/i);
    const fields = parseInsertFields(matches[2]);
    const values = parseInsertVals(matches[4]);

    return {
      entity: matches[1],
      data: fields.reduce((acc, cur, index) => {
        acc[cur] = values[index];
        return acc;
      }, {})
    };
  }
}

export function parseUpdate(query) {
  try {
    const ast = parser.astify(query, opt);

    if (ast.type !== "update") {
      throw new Error("Not an UPDATE query");
    }

    const entity = ast.table[0].table;
    const data = {};

    // Extract SET values
    if (ast.set) {
      for (const item of ast.set) {
        if (item.column && item.value) {
          const key = item.column;
          let value;

          if (item.value.type === "string") {
            value = item.value.value;
          } else if (item.value.type === "number") {
            value = item.value.value;
          } else {
            value = item.value.value?.toString();
          }

          data[key] = value;
        }
      }
    }

    // Extract ID from WHERE clause
    let id = null;
    if (ast.where && ast.where.operator === "=" && ast.where.left && ast.where.right) {
      id = ast.where.right.type === "string" ? ast.where.right.value : ast.where.right.value?.toString();
    }

    return {
      entity,
      data,
      id
    };
  } catch (error) {
    // Fallback to original behavior for unsupported queries
    console.warn(`SQL parsing error: ${error.message}. Using fallback parser.`);

    const [, resource, args, idSet] = query.split(/UPDATE\b|\bSET\b|\bWHERE\b/i);
    const entity = resource.trim();
    const argList = `{${args.replace(/[a-zA-Z0-9]+ =/g, (match) => {
      const [objProp] = match.split(" ");
      return `"${objProp}": `;
    })}}`.replace(/'/g, '"');
    const data = JSON.parse(argList);
    const id = idSet.split("=")[1].trim();

    return {
      entity,
      data,
      id
    };
  }
}

// Helper functions from the original implementation
function getJoinCond(conditions) {
  function buildJoinCondition(data, idx = 1) {
    const [condition, ...rest] = data;
    const [left, right] = condition.split("=");
    const [, key1] = left.split(".").map(trim);
    const [, key2] = right.split(".").map(trim);

    if (rest.length === 0) {
      return [[key1, key2]];
    } else {
      return [[key1, key2], ...buildJoinCondition(rest, idx + 2)];
    }
  }

  return buildJoinCondition(conditions);
}

function extractVals(item) {
  return item.split(",").map(trim);
}

function parseInsertVals(set) {
  const arrayString = set.replace(/[()']/g, (match) => {
    if (match === "(") {
      return "[";
    } else if (match === ")") {
      return "]";
    } else {
      return '"';
    }
  });
  return JSON.parse(arrayString);
}

function parseInsertFields(set) {
  return set.replace(/[()']/g, "").split(",").map(trim);
}

// Extract fields from AST
function extractFields(ast) {
  return ast.columns.map((col) => {
    return col.expr.column || col.expr.value || "*";
  });
}

// Extract tables/entities from AST
function extractEntities(ast) {
  const entities = [];
  if (ast.from) {
    for (const table of ast.from) {
      if (table.table) {
        entities.push(table.table);
      }
    }
  }
  return entities;
}

// Handle WHERE conditions from AST
function handleWhereConditions(ast) {
  let conditions = {};

  if (ast.where) {
    // Simple condition handling (field = value)
    if (ast.where.operator === "=" && ast.where.left && ast.where.right) {
      const field = ast.where.left.column;
      const value = ast.where.right.type === "string" ? ast.where.right.value : ast.where.right.value?.toString();

      conditions = { [field]: value, value };
    }
  }

  return conditions;
}

// Handle JOIN conditions from AST
function handleJoinConditions(ast, conditions) {
  let join = null;
  let joinCond = null;

  if (ast.from && ast.from.length > 1) {
    join = [];
    joinCond = [];

    for (const table of ast.from) {
      if (table.join && table.on) {
        // Add join type
        if (table.join === "LEFT JOIN") {
          join.push("LEFT JOIN");
        } else if (table.join === "FULL JOIN") {
          join.push("FULL JOIN");
        } else {
          join.push("JOIN");
        }

        // Extract join conditions
        if (table.on.operator === "=" && table.on.left && table.on.right) {
          const leftParts = table.on.left.column.split(".");
          const rightParts = table.on.right.column.split(".");

          const key1 = leftParts.length > 1 ? leftParts[1] : leftParts[0];
          const key2 = rightParts.length > 1 ? rightParts[1] : rightParts[0];

          joinCond.push([key1, key2]);
        }
      }
    }

    // Update conditions with join info
    if (join.length > 0) {
      conditions = { ...conditions, join, joinCond };
    }
  }

  return { conditions, join, joinCond };
}

// Handle fallback parsing for unsupported queries
function handleFallbackParsing(query, error) {
  console.warn(`SQL parsing error: ${error.message}. Using fallback parser.`);

  const joinMatch = query.match(/\bJOIN\b|\bLEFT JOIN\b|\bFULL JOIN\b/gi);
  const splitQuery = query.split(/SELECT\b|\bFROM\b|\bWHERE\b/i);
  const fields = splitQuery[1];

  let tables, conditions, joinCond, join;
  if (joinMatch) {
    const [rootTable, ...rest] = splitQuery[2].trim().split(/\bJOIN\b|\bLEFT JOIN\b|\bFULL JOIN\b|\bON\b/i);
    const { joinTables, clauses } = rest.reduce(
      (acc, cur, idx) => {
        acc[idx % 2 === 0 ? "joinTables" : "clauses"].push(cur.trim());
        return acc;
      },
      { joinTables: [rootTable], clauses: [] }
    );
    tables = joinTables.map(trim);
    joinCond = getJoinCond(clauses);
    conditions = splitQuery[3];
    join = joinMatch;
  } else {
    tables = splitQuery[2];
    conditions = splitQuery[3];
  }

  const [field, , value] = conditions ? conditions.trim().split(" ") : [];

  return {
    entities: joinMatch ? tables : extractVals(tables),
    fields: extractVals(fields),
    ...(conditions || joinMatch ? { conditions: { [field]: value, value, join, joinCond } } : {})
  };
}
