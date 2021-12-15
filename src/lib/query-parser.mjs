import { trim } from "./trim.mjs";

const parens = /[()']/g;
const joinFinder = /\bJOIN\b|\bLEFT JOIN\b|\bFULL JOIN\b/gi;
const joinSplitter = /\bJOIN\b|\bLEFT JOIN\b|\bFULL JOIN\b|\bON\b/i;
const simpleSplitter = /SELECT\b|\bFROM\b|\bWHERE\b/i;

export function parseSelect(query) {
  const joinMatch = query.match(joinFinder);

  const splitQuery = query.split(simpleSplitter);
  const fields = splitQuery[1];
  let tables, conditions, joinCond, join;
  if (joinMatch) {
    const [rootTable, ...rest] = splitQuery[2].trim().split(joinSplitter);
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

const singleTick = /'/g;
const sqlProp = /[a-zA-Z0-9]+ =/g;

export function parseUpdate(query) {
  const [, resource, args, idSet] = query.split(/UPDATE\b|\bSET\b|\bWHERE\b/i);
  const entity = resource.trim();
  const argList = `{${args.replace(sqlProp, (match) => {
    const [objProp] = match.split(" ");
    return `"${objProp}": `;
  })}}`.replace(singleTick, '"');
  const data = JSON.parse(argList);
  const id = idSet.split("=")[1].trim();

  return {
    entity,
    data,
    id
  };
}

function parseInsertVals(set) {
  const arrayString = set.replace(parens, (match) => {
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
  return set.replace(parens, "").split(",").map(trim);
}
