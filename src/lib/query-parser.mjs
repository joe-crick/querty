import { trim } from "./trim.mjs";

const parens = /[()']/g;
const joinFinder = /\bJOIN\b|\bLEFT\s+JOIN\b|\bFULL\s+JOIN\b/gi;
const joinSplitter = /\bJOIN\b|\bLEFT\s+JOIN\b|\bFULL\s+JOIN\b|\bON\b/i;

export function parseSelect(query) {
  const { fieldsStr, fromSegment, whereSegment, groupByStr, havingStr, orderByStr } = extractSelectSections(query);

  const fields = parseFieldsStr(fieldsStr);
  const groupBy = parseGroupByStr(groupByStr);
  const orderBy = parseOrderByStr(orderByStr);

  const { joinMatch, tables, joinCond, join } = parseFromSegmentDetails(fromSegment);
  const where = parseWhereSegment(whereSegment);

  // Build conditions object with care for IN operator (avoid setting single value/id pathing)
  const IN = "IN";
  const cond = (() => {
    // If no conditions exist, return undefined immediately.
    if (!whereSegment && !joinMatch && !groupBy && !havingStr && !orderBy) {
      return undefined;
    }

    const whereConditions = {};

    // Handle the 'where' clause logic with clear if/else statements.
    if (where?.operator === IN) {
      whereConditions.operator = IN;
      whereConditions.values = where.values;
      if (where.field) {
        whereConditions[where.field] = where.values;
      }
    } else if (where?.field) {
      // This handles the simple equality case.
      whereConditions.value = where.value;
      whereConditions[where.field] = where.value;
    }

    // Assemble the final conditions object.
    return {
      ...whereConditions,
      join,
      joinCond,
      groupBy,
      having: havingStr?.trim(),
      orderBy
    };
  })();

  return {
    entities: joinMatch ? tables : extractVals(tables),
    fields,
    ...(cond ? { conditions: cond } : {})
  };
}

function extractSelectSections(query) {
  // Robust parsing tolerant of variable whitespace and newlines using numbered groups (no named groups)
  // Standard order: SELECT ... FROM ... [WHERE ...] [GROUP BY ...] [HAVING ...] [ORDER BY ...]
  const selectRegex = new RegExp(
    [
      /^\s*SELECT\s+([\s\S]*?)/, // 1: fields
      /\s+FROM\s+([\s\S]*?)/, // 2: from segment (up to WHERE/GROUP BY/HAVING/ORDER BY/end)
      /(?:\s+WHERE\s+([\s\S]*?))?/, // 3: optional WHERE
      /(?:\s+GROUP\s+BY\s+([\s\S]*?))?/, // 4: optional GROUP BY
      /(?:\s+HAVING\s+([\s\S]*?))?/, // 5: optional HAVING
      /(?:\s+ORDER\s+BY\s+([\s\S]*?))?\s*$/ // 6: optional ORDER BY
    ]
      .map((r) => r.source)
      .join(""),
    "i"
  );

  const match = query.match(selectRegex);
  if (!match) {
    throw new Error("Invalid or unsupported SELECT query format");
  }

  const fieldsStr = (match[1] || "").trim();
  const fromSegment = (match[2] || "").trim();
  const whereSegment = match[3] ? match[3].trim() : undefined;
  const groupByStr = match[4] ? match[4].trim() : undefined;
  const havingStr = match[5] ? match[5].trim() : undefined;
  const orderByStr = match[6] ? match[6].trim() : undefined;

  return { fieldsStr, fromSegment, whereSegment, groupByStr, havingStr, orderByStr };
}

function parseFieldsStr(fieldsStr) {
  return extractVals(fieldsStr);
}

function parseGroupByStr(groupByStr) {
  return groupByStr ? extractVals(groupByStr) : undefined;
}

function parseOrderByStr(orderByStr) {
  if (!orderByStr) return undefined;
  const items = orderByStr.split(",").map((s) => s.trim()).filter(Boolean);
  return items.map((item) => {
    const parts = item.split(/\s+/).filter(Boolean);
    const maybeDir = parts[parts.length - 1]?.toUpperCase();
    let direction = "ASC";
    if (maybeDir === "ASC" || maybeDir === "DESC") {
      parts.pop();
      direction = maybeDir;
    }
    const field = parts.join(" ").trim();
    return { field, direction };
  });
}

function parseFromSegmentDetails(fromSegment) {
  const joinMatch = fromSegment.match(joinFinder);

  if (joinMatch) {
    const [rootTable, ...rest] = fromSegment.split(joinSplitter);
    const { joinTables, clauses } = rest.reduce(
      (acc, cur, idx) => {
        acc[idx % 2 === 0 ? "joinTables" : "clauses"].push(cur.trim());
        return acc;
      },
      { joinTables: [rootTable.trim()], clauses: [] }
    );
    const tables = joinTables.map(trim);
    const joinCond = getJoinCond(clauses);
    return { joinMatch, tables, joinCond, join: joinMatch };
  }

  return { joinMatch: null, tables: fromSegment, joinCond: undefined, join: undefined };
}

function parseWhereSegment(whereSegment) {
  let field, value;
  if (whereSegment && whereSegment.length > 0) {
    const inMatch = whereSegment.match(/^(.*?)\s+IN\s*\(([\s\S]*?)\)\s*$/i);
    if (inMatch) {
      const lhs = inMatch[1].trim();
      const listStr = inMatch[2].trim();
      const values = parseInsertVals(`(${listStr})`);
      return { field: lhs, operator: "IN", values };
    }
    const eqIdx = whereSegment.indexOf("=");
    if (eqIdx !== -1) {
      field = whereSegment.slice(0, eqIdx).trim();
      value = whereSegment.slice(eqIdx + 1).trim();
    }
  }
  return { field, value };
}

function getJoinCond(conditions) {
  const output = [];
  for (let i = 0; i < conditions.length; i++) {
    const condition = conditions[i];
    const [left, right] = condition.split("=");
    const [, key1] = left.split(".").map(trim);
    const [, key2] = right.split(".").map(trim);
    output.push([key1, key2]);
  }
  return output;
}

function extractVals(item) {
  return item.split(",").map(trim);
}

export function parseInsert(query) {
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

export function parseUpdate(query) {
  const updateRegex = new RegExp(
    [/^s*UPDATEs+(\w+)/, /s+SETs+(.*?)/, /s+WHEREs+(.*)$/].map((r) => r.source.replace(/s/g, "\\s")).join(""),
    "i"
  );

  const match = query.match(updateRegex);
  if (!match) {
    throw new Error("Invalid or unsupported UPDATE query format");
  }

  const entity = match[1];
  const setClause = match[2];
  const whereClause = match[3];
  const pairs = /(\w+)\s*=\s*(?:'([^']*)'|(\S+?))(?:,|$)/g;
  const data = getUpdateData(setClause, pairs);

  const id = whereClause.split("=")[1].trim();

  return {
    entity: entity.trim(),
    data,
    id
  };
}

function getUpdateData(setClause, pairs) {
  return Object.fromEntries(
    [...setClause.matchAll(pairs)].map(([, key, quoted, unquoted]) => {
      const valueStr = quoted !== undefined ? quoted : unquoted;
      const finalValue = valueStr && !isNaN(valueStr) && valueStr.trim() !== "" ? Number(valueStr) : valueStr;
      return [key.trim(), finalValue];
    })
  );
}

function parseInsertVals(set) {
  // Trim parentheses and then split by comma
  const values = set.trim().slice(1, -1).split(",");

  return values.map((val) => {
    const trimmedVal = val.trim();
    const isQuotedString = trimmedVal.startsWith("'") && trimmedVal.endsWith("'");
    if (isQuotedString) {
      return trimmedVal.slice(1, -1);
    }
    const isNumber = !isNaN(trimmedVal) && trimmedVal.trim() !== "";
    if (isNumber) {
      return Number(trimmedVal);
    }
    const isNull = trimmedVal.toLowerCase() === "null";
    if (isNull) {
      return null;
    }
    return trimmedVal;
  });
}

function parseInsertFields(set) {
  return set.replace(parens, "").split(",").map(trim);
}

export function parseDelete(query) {
  const deleteRegex = new RegExp(
    [/^s*DELETEs+FROMs+(\w+)/, /s+WHEREs+(.*)$/].map((r) => r.source.replace(/s/g, "\\s")).join(""),
    "i"
  );

  const match = query.match(deleteRegex);
  if (!match) {
    throw new Error("Invalid or unsupported DELETE query format");
  }

  const entity = match[1];
  const whereClause = match[2];
  // Assumes a simple `id = value` condition
  const id = whereClause.split("=")[1].trim();

  return {
    entity,
    id
  };
}
