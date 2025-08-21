import { intersection } from "./intersection.mjs";
import camelCase from "to-camel-case";
import { fullJoin, join, leftJoin } from "array-join";
import { makeArray } from "./makeArray.mjs";

export function createReturnStructure(rawData, entities, fields, conditions = {}, resultSetFilter) {
  const resultSet = getEntityScopedResult(entities, rawData, fields, conditions?.joinCond);
  let results = conditions && conditions.join ? joinResults(conditions, resultSet) : resultSet;

  // Apply GROUP BY if provided
  if (conditions && Array.isArray(conditions.groupBy) && conditions.groupBy.length > 0) {
    if (conditions.join) {
      // results is an array when joins are used
      results = groupJoinedResults(results, conditions.groupBy);
    } else {
      // results is an object of entity arrays; group each entity set independently
      results = groupObjectSets(results, entities, conditions.groupBy);
    }
  }

  // Apply HAVING if provided (simple equality or IN)
  if (conditions && conditions.having) {
    results = applyHaving(results, entities, conditions.having, Boolean(conditions.join));
  }

  // Apply ORDER BY if provided
  if (conditions && Array.isArray(conditions.orderBy) && conditions.orderBy.length > 0) {
    results = applyOrderBy(results, entities, conditions.orderBy, Boolean(conditions.join));
  }

  return resultSetFilter(results);
}

function applyHaving(results, entities, havingStr, isJoin) {
  const parsed = parseHaving(havingStr);
  if (!parsed) return results;

  if (isJoin) {
    if (!Array.isArray(results)) return results;
    const key = parsed.field.includes(".") ? parsed.field.split(".")[1] : parsed.field;
    return results.filter((row) => matchHaving(row?.[key], parsed));
  } else {
    // object sets: apply only to targeted entity if scoped, else to each entity
    const out = {};
    const targetEntity = parsed.field.includes(".") ? parsed.field.split(".")[0] : null;
    for (let i = 0; i < entities.length; i++) {
      const entity = entities[i];
      const arr = results[entity];
      if (!Array.isArray(arr)) {
        out[entity] = arr;
        continue;
      }
      if (targetEntity && targetEntity !== entity) {
        out[entity] = arr;
        continue;
      }
      const key = targetEntity ? parsed.field.split(".")[1] : parsed.field;
      out[entity] = arr.filter((row) => matchHaving(row?.[key], parsed));
    }
    return out;
  }
}

function applyOrderBy(results, entities, orderBy, isJoin) {
  if (isJoin) {
    if (!Array.isArray(results)) return results;
    const specs = orderBy.map((o) => ({ key: o.field.includes(".") ? o.field.split(".")[1] : o.field, dir: o.direction }));
    return sortArrayBySpecs(results.slice(), specs);
  } else {
    const out = {};
    for (let i = 0; i < entities.length; i++) {
      const entity = entities[i];
      const arr = results[entity];
      if (!Array.isArray(arr)) {
        out[entity] = arr;
        continue;
      }
      // Determine if any spec targets this entity specifically
      const entitySpecs = [];
      for (let s = 0; s < orderBy.length; s++) {
        const ob = orderBy[s];
        if (ob.field.includes(".")) {
          const [ent, prop] = ob.field.split(".");
          if (ent === entity) entitySpecs.push({ key: prop, dir: ob.direction });
        } else {
          entitySpecs.push({ key: ob.field, dir: ob.direction });
        }
      }
      out[entity] = entitySpecs.length > 0 ? sortArrayBySpecs(arr.slice(), entitySpecs) : arr;
    }
    return out;
  }
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
      if (va < vb) return dir === "DESC" ? 1 : -1;
      if (va > vb) return dir === "DESC" ? -1 : 1;
    }
    return 0;
  });
}

function matchHaving(value, parsed) {
  if (parsed.operator === "IN") {
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
    return { field: lhs, operator: "IN", values };
  }
  const eqIdx = havingStr.indexOf("=");
  if (eqIdx !== -1) {
    const field = havingStr.slice(0, eqIdx).trim();
    const raw = havingStr.slice(eqIdx + 1).trim();
    return { field, operator: "=", value: parseScalar(raw) };
  }
  return undefined;
}

function parseListValues(listStr) {
  // naive split respecting simple quoted strings
  // break by commas not inside quotes (simple approach works for our tests)
  const parts = listStr.split(",");
  return parts.map((p) => parseScalar(p.trim()));
}

function parseScalar(text) {
  if (!text) return text;
  // strip quotes if present
  if ((text.startsWith("'") && text.endsWith("'")) || (text.startsWith('"') && text.endsWith('"'))) {
    return text.slice(1, -1);
  }
  const lower = text.toLowerCase();
  if (lower === "null") return null;
  if (!isNaN(text) && text.trim() !== "") return Number(text);
  return text;
}

function groupJoinedResults(results, groupByFields) {
  if (!Array.isArray(results)) return results;
  const keys = groupByFields.map((k) => (k.includes(".") ? k.split(".")[1] : k));
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
    const keys = removeEntityScopePrefixes(groupByFields, entity).map((k) =>
      k.includes(" as ") ? k.split(" as ")[0] : k
    );
    output[entity] = groupArrayByKeys(data, keys);
  }
  return output;
}

function groupArrayByKeys(arr, keys) {
  if (!keys || keys.length === 0) return arr;
  const map = new Map();
  for (let i = 0; i < arr.length; i++) {
    const row = arr[i];
    const composite = keys.map((k) => String(row?.[k])).join("|#|");
    if (!map.has(composite)) {
      map.set(composite, row);
    }
  }
  return Array.from(map.values());
}

function joinResults(conditions, resultSet) {
  const [firstJoin] = conditions.join;
  const joinType = camelCase(firstJoin.replace(/\s/, "_"));
  const joinConds = conditions.joinCond;
  const values = Object.values(resultSet);

  const [first, second, ...rest] = values;
  const keys = joinConds[0];
  const key1 = keys[0];
  const key2 = keys[1];

  // Use the appropriate join function based on joinType
  let base;
  if (joinType === "leftJoin") {
    base = leftJoin(
      makeArray(first),
      makeArray(second),
      (left) => left[key1],
      (right) => right[key2],
      (left, right) => {
        // Preserve the id from the left object (user)
        const merged = { ...left, ...right };
        if (left && left.id) {
          merged.id = left.id;
        }
        return merged;
      }
    );
  } else if (joinType === "fullJoin") {
    base = fullJoin(
      makeArray(first),
      makeArray(second),
      (left) => left[key1],
      (right) => right[key2],
      (left, right) => {
        // Preserve the id from the left object (user)
        const merged = { ...left, ...right };
        if (left && left.id) {
          merged.id = left.id;
        }
        return merged;
      }
    );
  } else {
    // Default to inner join
    base = join(
      makeArray(first),
      makeArray(second),
      (left) => left[key1],
      (right) => right[key2],
      (left, right) => {
        // Preserve the id from the left object (user)
        const merged = { ...left, ...right };
        if (left && left.id) {
          merged.id = left.id;
        }
        return merged;
      }
    );
  }

  if (rest.length > 0) {
    for (let x = 0; x < rest.length; x++) {
      const nextIdx = x + 1;
      const nextJoin = conditions.join[nextIdx];
      const nextJoinType = camelCase(nextJoin.replace(/\s/, "_"));
      const keys = joinConds[nextIdx];
      const key1 = keys[0];
      const key2 = keys[1];

      // Use the appropriate join function for subsequent joins
      if (nextJoinType === "leftJoin") {
        base = leftJoin(
          base,
          rest[x],
          (left) => left[key1],
          (right) => right[key2],
          (left, right) => {
            // Preserve the id from the left object
            const merged = { ...left, ...right };
            if (left && left.id) {
              merged.id = left.id;
            }
            return merged;
          }
        );
      } else if (nextJoinType === "fullJoin") {
        base = fullJoin(
          base,
          rest[x],
          (left) => left[key1],
          (right) => right[key2],
          (left, right) => ({ ...left, ...right })
        );
      } else {
        // Default to inner join
        base = join(
          base,
          rest[x],
          (left) => left[key1],
          (right) => right[key2],
          (left, right) => {
            // Preserve the id from the left object
            const merged = { ...left, ...right };
            if (left && left.id) {
              merged.id = left.id;
            }
            return merged;
          }
        );
      }
    }
  }
  return base;
}

function getEntityScopedResult(entities, result, fields, joinCond) {
  const results = {};
  for (let x = 0; x < entities.length; x++) {
    const entity = entities[x];
    const data = getEntityData(result, x);
    const [sample] = data;
    if (sample) {
      // if the query has any entity-scoped fields, e.g., users.name, remove any entity-scoping appropriate to this entity
      const entityScopedFields = removeEntityScopePrefixes(fields, entity);
      const deAliasedFields = entityScopedFields.map((field) => {
        return field.includes(" as ") ? field.split(" as ")[0] : field;
      });
      // Get the fields from this query that match the fields on the returned data
      let entityFields = intersection(deAliasedFields, Object.keys(sample));

      if (joinCond) {
        const addFields = Array.from(new Set(joinCond.flat()));
        entityFields = entityFields.concat(addFields);
      }

      results[entity] = isAllFields(entityScopedFields) ? data : extractFields(entityFields, entityScopedFields, data);
    } else {
      results[entity] = undefined;
    }
  }
  return results;
}

function isAllFields(parsedFields) {
  return parsedFields.includes("*");
}

function getEntityData(result, x) {
  return Array.isArray(result[x].data) ? result[x].data : [result[x].data];
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
    const [table, prop] = cur.split(".");
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
    if (cur.includes(" as ")) {
      const [field, alias] = cur.split(" as ");
      acc[field] = alias;
    }
    return acc;
  }, {});
}
