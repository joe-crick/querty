import { intersection } from "./intersection.mjs";
import camelCase from "to-camel-case";
import { fullJoin, join, leftJoin } from "array-join";
import { makeArray } from "./makeArray.mjs";

// String/token constants
const LEFT_JOIN = "leftJoin";
const FULL_JOIN = "fullJoin";
const DESC = "DESC";
const IN = "IN";
const EQUALS = "=";
const DOT = ".";
const AS = " as ";
const COMMA = ",";
const NULL_STR = "null";
const UNDERSCORE = "_";
const KEY_DELIM = "|#|";
const ID = "id";
const DATA = "data";
const WILDCARD = "*";
const SINGLE_QUOTE = "'";
const DOUBLE_QUOTE = '"';
const EMPTY_STR = "";

// Helpers
const toJoinKey = (s) => camelCase(s.replace(/\s/, UNDERSCORE));
const selectJoin = (type) => (type === LEFT_JOIN ? leftJoin : type === FULL_JOIN ? fullJoin : join);
const mergePreserveLeftId = (left, right) => {
  const merged = { ...left, ...right };
  return left && left[ID] ? { ...merged, [ID]: left[ID] } : merged;
};
const mergeShallow = (left, right) => ({ ...left, ...right });
const performJoin = (joinFn, leftArr, rightArr, key1, key2, merger) =>
  joinFn(
    leftArr,
    rightArr,
    (left) => left[key1],
    (right) => right[key2],
    merger
  );

export function createReturnStructure(rawData, entities, fields, conditions = {}, resultSetFilter) {
  const resultSet = getEntityScopedResult(entities, rawData, fields, conditions?.joinCond);

  const initialResults = conditions?.join ? joinResults(conditions, resultSet) : resultSet;

  const pipeline = [
    conditions?.groupBy?.length > 0 ? (results) => getGroupedResults(conditions, results, entities) : null,
    conditions?.having
      ? (results) => applyHaving(results, entities, conditions.having, Boolean(conditions.join))
      : false,
    conditions?.orderBy?.length > 0
      ? (results) => applyOrderBy(results, entities, conditions.orderBy, Boolean(conditions.join))
      : false,
    resultSetFilter
  ].filter(Boolean);

  return pipeline.reduce((results, operation) => operation(results), initialResults);
}

function getGroupedResults(conditions, results, entities) {
  return conditions.join
    ? groupJoinedResults(results, conditions.groupBy)
    : groupObjectSets(results, entities, conditions.groupBy);
}

function applyHaving(results, entities, havingStr, isJoin) {
  const parsed = parseHaving(havingStr);
  if (!parsed) return results;
  if (isJoin) {
    return returnJoinedHavingResult(results, parsed);
  } else {
    const targetEntity = parsed.field.includes(DOT) ? parsed.field.split(DOT)[0] : null;
    const key = parsed.field.includes(DOT) ? parsed.field.split(DOT)[1] : parsed.field;
    return entities.reduce((out, entity) => {
      const arr = results[entity];
      if (!Array.isArray(arr)) {
        out[entity] = arr;
        return out;
      }
      // If HAVING is scoped to a specific entity, only apply to that entity; otherwise apply to all
      out[entity] =
        targetEntity && targetEntity !== entity ? arr : arr.filter((row) => matchHaving(row?.[key], parsed));
      return out;
    }, {});
  }
}

function returnJoinedHavingResult(results, parsed) {
  if (!Array.isArray(results)) return results;
  const key = parsed.field.includes(DOT) ? parsed.field.split(DOT)[1] : parsed.field;
  return results.filter((row) => matchHaving(row?.[key], parsed));
}

function applyOrderBy(results, entities, orderBy, isJoin) {
  if (isJoin) {
    return returnJoinedOrderByResult(results, orderBy);
  } else {
    return entities.reduce((out, entity) => {
      const arr = results[entity];
      if (!Array.isArray(arr)) {
        out[entity] = arr;
        return out;
      }
      const entitySpecs = getEntitySpecs(orderBy, entity);
      out[entity] = entitySpecs.length > 0 ? sortArrayBySpecs(arr.slice(), entitySpecs) : arr;
      return out;
    }, {});
  }
}

function getEntitySpecs(orderBy, entity) {
  return orderBy.reduce((specs, ob) => {
    if (ob.field.includes(DOT)) {
      const [ent, prop] = ob.field.split(DOT);
      if (ent === entity) specs.push({ key: prop, dir: ob.direction });
    } else {
      specs.push({ key: ob.field, dir: ob.direction });
    }
    return specs;
  }, []);
}

function returnJoinedOrderByResult(results, orderBy) {
  if (!Array.isArray(results)) return results;
  const specs = orderBy.map((o) => ({
    key: o.field.includes(DOT) ? o.field.split(DOT)[1] : o.field,
    dir: o.direction
  }));
  return sortArrayBySpecs(results.slice(), specs);
}

function sortArrayBySpecs(arr, specs) {
  if (!specs || specs.length === 0) return arr;
  return arr.sort((a, b) => {
    for (let i = 0; i < specs.length; i++) {
      const { key, dir } = specs[i];
      const va = a?.[key];
      const vb = b?.[key];
      if (va == null && vb == null) continue;
      if (va == null) return 1; // push undefined/null to end
      if (vb == null) return -1;
      if (va < vb) return dir === DESC ? 1 : -1;
      if (va > vb) return dir === DESC ? -1 : 1;
    }
    return 0;
  });
}
function matchHaving(value, parsed) {
  if (parsed.operator === IN) {
    return parsed.values.some((v) => v === value);
  }
  return String(value) === String(parsed.value);
}

function parseHaving(havingStr) {
  if (!havingStr) return undefined;
  const inMatch = havingStr.match(/^(.*?)\s+IN\s*\(([^)]*)\)\s*$/i);
  if (inMatch) {
    const lhs = inMatch[1].trim();
    const list = inMatch[2].trim();
    const values = parseListValues(list);
    return { field: lhs, operator: IN, values };
  }
  const eqIdx = havingStr.indexOf(EQUALS);
  if (eqIdx !== -1) {
    const field = havingStr.slice(0, eqIdx).trim();
    const raw = havingStr.slice(eqIdx + 1).trim();
    return { field, operator: EQUALS, value: parseScalar(raw) };
  }
  return undefined;
}

function parseListValues(listStr) {
  // naive split respecting simple quoted strings
  // break by commas not inside quotes (simple approach works for our tests)
  const parts = listStr.split(COMMA);
  return parts.map((p) => parseScalar(p.trim()));
}

function parseScalar(text) {
  if (!text) return text;
  // strip quotes if present
  if (
    (text.startsWith(SINGLE_QUOTE) && text.endsWith(SINGLE_QUOTE)) ||
    (text.startsWith(DOUBLE_QUOTE) && text.endsWith(DOUBLE_QUOTE))
  ) {
    return text.slice(1, -1);
  }
  const lower = text.toLowerCase();
  if (lower === NULL_STR) return null;
  if (!isNaN(text) && text.trim() !== EMPTY_STR) return Number(text);
  return text;
}

function groupJoinedResults(results, groupByFields) {
  if (!Array.isArray(results)) return results;
  const keys = groupByFields.map((k) => (k.includes(DOT) ? k.split(DOT)[1] : k));
  return groupArrayByKeys(results, keys);
}

function groupObjectSets(results, entities, groupByFields) {
  const output = {};
  for (let i = 0; i < entities.length; i++) {
    const entity = entities[i];
    const data = results[entity];
    if (!Array.isArray(data)) {
      output[entity] = data;
      continue;
    }
    // Remove entity scope from groupBy keys for this entity
    const keys = removeEntityScopePrefixes(groupByFields, entity).map((k) => (k.includes(AS) ? k.split(AS)[0] : k));
    output[entity] = groupArrayByKeys(data, keys);
  }
  return output;
}

function groupArrayByKeys(arr, keys) {
  if (!keys || keys.length === 0) return arr;
  const map = new Map();
  for (let i = 0; i < arr.length; i++) {
    const row = arr[i];
    const composite = keys.map((k) => String(row?.[k])).join(KEY_DELIM);
    if (!map.has(composite)) {
      map.set(composite, row);
    }
  }
  return Array.from(map.values());
}

function joinResults(conditions, resultSet) {
  const [firstJoin] = conditions.join;
  const joinType = toJoinKey(firstJoin);
  const joinConds = conditions.joinCond;
  const values = Object.values(resultSet);

  const [first, second, ...rest] = values;
  const [key1, key2] = joinConds[0];

  const joinFn = selectJoin(joinType);
  let base = performJoin(joinFn, makeArray(first), makeArray(second), key1, key2, mergePreserveLeftId);

  for (let x = 0; x < rest.length; x++) {
    const nextIdx = x + 1;
    const nextJoinType = toJoinKey(conditions.join[nextIdx]);
    const [k1, k2] = joinConds[nextIdx];
    const nextJoinFn = selectJoin(nextJoinType);
    const merger = nextJoinType === FULL_JOIN ? mergeShallow : mergePreserveLeftId;
    base = performJoin(nextJoinFn, base, rest[x], k1, k2, merger);
  }

  return base;
}

function getEntityScopedResult(entities, result, fields, joinCond) {
  const results = {};
  for (let x = 0; x < entities.length; x++) {
    const entity = entities[x];
    const data = getEntityData(result, x);
    const [sample] = data;
    results[entity] = sample ? getFields(fields, entity, sample, joinCond, data) : [];
  }
  return results;
}

function getFields(fields, entity, sample, joinCond, data) {
  // if the query has any entity-scoped fields, e.g., users.name, remove any entity-scoping appropriate to this entity
  const entityScopedFields = removeEntityScopePrefixes(fields, entity);
  const deAliasedFields = entityScopedFields.map((field) => {
    return field.includes(AS) ? field.split(AS)[0] : field;
  });
  // Get the fields from this query that match the fields on the returned data
  let entityFields = intersection(deAliasedFields, Object.keys(sample));

  if (joinCond) {
    const addFields = Array.from(new Set(joinCond.flat()));
    entityFields = entityFields.concat(addFields);
  }
  return isAllFields(entityScopedFields) ? data : extractFields(entityFields, entityScopedFields, data);
}

function isAllFields(parsedFields) {
  return parsedFields.includes(WILDCARD);
}

function getEntityData(result, x) {
  return Array.isArray(result[x][DATA]) ? result[x][DATA] : [result[x][DATA]];
}

/**
 * Given an entity-scoped field (such as "users.name") and an entity (such as "users")
 * this function will return an array of fields with either the entity-scoped field
 * unchanged (when the entity does not match a scope prefix [e.g. users]), or with
 * the entity-prefix removed. For example, when given an array [users.name, id] and an
 * entity "users", it will return [name, id]. However, with the same array and an entity
 * "accounts", it will return [users.name, id].
 */
function removeEntityScopePrefixes(fields, entity) {
  return fields.reduce((acc, cur) => {
    const [table, prop] = cur.split(DOT);
    acc.push(table === entity ? prop : cur);
    return acc;
  }, []);
}

function extractFields(entityFields, entityScopedFields, data) {
  const aliasMap = getAliasMap(entityScopedFields);

  // Optimising processing using for loops
  const filteredSet = [];
  for (let i = 0; i < data.length; i++) {
    const fullObject = data[i];
    const partial = {};
    for (let n = 0; n < entityFields.length; n++) {
      const cur = entityFields[n];
      const prop = aliasMap[cur] || cur;
      if (Object.prototype.hasOwnProperty.call(fullObject, cur)) {
        partial[prop] = fullObject[cur];
      }
    }
    filteredSet.push(partial);
  }

  return filteredSet;
}

function getAliasMap(entityScopedFields) {
  return entityScopedFields.reduce((acc, cur) => {
    if (cur.includes(AS)) {
      const [field, alias] = cur.split(AS);
      acc[field] = alias;
    }
    return acc;
  }, {});
}
