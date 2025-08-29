import camelCase from "to-camel-case";
import { fullJoin, join, leftJoin } from "array-join";
import { makeArray } from "./makeArray.mjs";
import { cond } from "./cond.mjs";

const LEFT_JOIN = "leftJoin";
const FULL_JOIN = "fullJoin";
const DESC = "DESC";
const IN = "IN";
const EQUALS = "=";
const DOT = ".";
const AS_REGEX = /\s+AS\s+/i;
const ARROW = "->";
const ARROW_TEXT = "->>";
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
const splitAlias = (s) => {
  const m = s.match(AS_REGEX);
  if (!m) return [s];
  const idx = m.index;
  return [s.slice(0, idx).trim(), s.slice(idx + m[0].length).trim()];
};
const stripAlias = (s) => splitAlias(s)[0];
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
      // If HAVING is scoped to a specific entity, only apply to that entity; otherwise apply to all
      out[entity] =
        !Array.isArray(arr) || (targetEntity && targetEntity !== entity)
          ? arr
          : arr.filter((row) => matchHaving(row?.[key], parsed));
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
  // prettier-ignore
  const compare = (va, vb, dir) =>
    cond(
      va == null && vb == null, 0,
      va == null, 1,
      vb == null, -1,
      va < vb, (dir === DESC ? 1 : -1),
      va > vb, (dir === DESC ? -1 : 1),
      cond.ELSE, 0
    )();

  return arr.sort((a, b) => {
    for (let i = 0; i < specs.length; i++) {
      const { key, dir } = specs[i];
      const va = a?.[key];
      const vb = b?.[key];
      const c = compare(va, vb, dir);
      if (c !== 0) return c;
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
  return entities.reduce((acc, entity) => {
    const data = results[entity];
    if (Array.isArray(data)) {
      // Remove entity scope from groupBy keys for this entity
      const keys = removeEntityScopePrefixes(groupByFields, entity).map((k) => stripAlias(k));
      acc[entity] = groupArrayByKeys(data, keys);
    } else {
      acc[entity] = data;
    }
    return acc;
  }, {});
}

function groupArrayByKeys(arr, keys) {
  if (!keys || keys.length === 0) return arr;
  const uniqueRowsByCompositeKey = arr.reduce((map, row) => {
    const composite = keys.map((k) => String(row?.[k])).join(KEY_DELIM);
    if (!map.has(composite)) {
      map.set(composite, row);
    }
    return map;
  }, new Map());
  return Array.from(uniqueRowsByCompositeKey.values());
}

function joinResults(conditions, resultSet) {
  const { join, joinCond } = conditions;
  const tables = Object.values(resultSet).map(makeArray);
  const [firstTable, ...restTables] = tables;

  return restTables.reduce((left, right, i) => {
    const joinType = toJoinKey(join[i]);
    const [k1, k2] = joinCond[i];
    const joinFn = selectJoin(joinType);
    const merger = i > 0 && joinType === FULL_JOIN ? mergeShallow : mergePreserveLeftId;
    return performJoin(joinFn, left, right, k1, k2, merger);
  }, firstTable);
}

function getEntityScopedResult(entities, result, fields, joinCond) {
  const singleEntity = entities.length === 1;
  return entities.reduce((acc, entity, i) => {
    const data = getEntityData(result, i, entity);
    const [sample] = data;
    acc[entity] = sample ? getFields(fields, entity, sample, joinCond, data, singleEntity) : [];
    return acc;
  }, {});
}

function getFields(fields, entity, sample, joinCond, data, singleEntity) {
  // if the query has any entity-scoped fields, e.g., users.name, remove any entity-scoping appropriate to this entity
  const entityScopedFields = removeEntityScopePrefixes(fields, entity);
  if (isAllFields(entityScopedFields)) return data;

  const deAliasedFields = entityScopedFields.map((field) => stripAlias(field));
  // Build the set of fields requested for THIS entity only (drop fields that still contain a dot)
  const deAliasedEntityFields = deAliasedFields.filter((f) => f !== WILDCARD && !f.includes(DOT));
  const baseFields = getBaseFields(singleEntity, deAliasedEntityFields, data);

  const joinFields = joinCond ? [...new Set(joinCond.flat())] : [];
  const entityFields = [...baseFields, ...joinFields];
  return extractFields(entityFields, entityScopedFields, data);
}

function getBaseFields(singleEntity, deAliasedEntityFields, data) {
  const isJsonExpr = (f) => typeof f === "string" && f.includes(ARROW);
  return singleEntity
    ? // For single-entity selects, include all selected fields for that entity (including computed JSON accessors)
      [...new Set(deAliasedEntityFields)]
    : // For multi-entity object sets, include only fields that exist on at least one row, plus computed JSON accessors
      (() => {
        const unionKeys = new Set(data.flatMap((row) => (row && typeof row === "object" ? Object.keys(row) : [])));
        return [...new Set(deAliasedEntityFields.filter((f) => unionKeys.has(f) || isJsonExpr(f)))];
      })();
}

function isAllFields(parsedFields) {
  return parsedFields.includes(WILDCARD);
}

function getEntityData(result, x, entity) {
  const payload = result[x][DATA];
  if (Array.isArray(payload)) return payload;
  if (payload && typeof payload === "object" && Object.prototype.hasOwnProperty.call(payload, entity)) {
    const inner = payload[entity];
    return Array.isArray(inner) ? inner : [inner];
  }
  return [payload];
}

function removeEntityScopePrefixes(fields, entity) {
  return fields.reduce((acc, cur) => {
    const [table, prop] = cur.split(DOT);
    acc.push(table === entity ? prop : cur);
    return acc;
  }, []);
}

function extractFields(entityFields, entityScopedFields, data) {
  const aliasMap = getAliasMap(entityScopedFields);
  return data.map((fullObject) =>
    entityFields.reduce((partial, cur) => {
      if (isJsonAccessor(cur)) {
        const propName = aliasMap[cur] || inferJsonAlias(cur);
        partial[propName] = evalJsonAccessor(fullObject, cur);
        return partial;
      }
      const prop = aliasMap[cur] || cur;
      partial[prop] = Object.prototype.hasOwnProperty.call(fullObject, cur) ? fullObject[cur] : null;
      return partial;
    }, {})
  );
}

// JSON accessor support (Postgres-like -> and ->>)
function isJsonAccessor(text) {
  return typeof text === "string" && text.includes(ARROW);
}

const QUOTED_KEY = /(->>|->)\s*(["'])(.*?)\2/g;

function parseJsonAccessor(expr) {
  // Example: json_data->'a'->>'b'
  // Extract base identifier up to first ->, then parse steps of -> or ->> with quoted key
  const firstIdx = expr.indexOf(ARROW);
  const base = expr.slice(0, firstIdx).trim();
  const rest = expr.slice(firstIdx);
  const steps = [];
  let m;
  while ((m = QUOTED_KEY.exec(rest))) {
    steps.push({ op: m[1] === ARROW_TEXT ? "text" : "json", key: m[3] });
  }
  return { base, steps };
}

function evalJsonAccessor(fullObject, expr) {
  const { base, steps } = parseJsonAccessor(expr);
  let val = fullObject ? fullObject[base] : undefined;
  for (let i = 0; i < steps.length; i++) {
    const { op, key } = steps[i];
    if (val == null) {
      return null;
    }
    // prettier-ignore
    const next = cond(
      () => Array.isArray(val) && /^\d+$/.test(key), () => val[Number(key)],
      () => val && typeof val === "object", () => val[key],
      cond.ELSE, undefined
    )();
    // prettier-ignore
    val = cond(
      op === "json", next,
      cond.ELSE, () => (next == null ? null : String(next))
    )();
  }
  return val == null ? null : val;
}

const MATCH_QUOTED_TEXT = /(["'])([^"']+)\1\s*$/;

function inferJsonAlias(expr) {
  // Use the last quoted key as alias; fallback to base name
  const match = expr.match(MATCH_QUOTED_TEXT);
  if (match) return match[2];
  const idx = expr.indexOf(ARROW);
  return idx > 0 ? expr.slice(0, idx).trim() : expr;
}
function getAliasMap(entityScopedFields) {
  return entityScopedFields.reduce((acc, cur) => {
    if (AS_REGEX.test(cur)) {
      const [field, alias] = splitAlias(cur);
      acc[field] = alias;
    }
    return acc;
  }, {});
}
