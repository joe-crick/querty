import { intersection } from "./intersection.mjs";
import camelCase from "to-camel-case";
import joiner from "array-join";
import { makeArray } from "./makeArray.mjs";

export function createReturnStructure(rawData, entities, fields, conditions = {}) {
  let resultSet = getEntityScopedResult(entities, rawData, fields, conditions?.joinCond);

  // TODO calculations?
  if (conditions && conditions.join) {
    const [firstJoin] = conditions.join;
    const joinType = camelCase(firstJoin.replace(/\s/, "_"));
    const joinConds = conditions.joinCond;
    const values = Object.values(resultSet);

    const [first, second, ...rest] = values;
    const keys = joinConds[0];
    const joinKeys = { key1: keys[0], key2: keys[1] };
    let base = joiner[joinType](makeArray(first), makeArray(second), joinKeys);

    if (rest.length > 0) {
      for (let x = 0; x < rest.length; x++) {
        const nextIdx = x + 1;
        const firstJoin = conditions.join[nextIdx];
        const joinType = camelCase(firstJoin.replace(/\s/, "_"));
        const keys = joinConds[nextIdx];
        const joinKeys = { key1: keys[0], key2: keys[1] };
        base = joiner[joinType](base, rest[x], joinKeys);
      }
    }
    resultSet = base;
  }
  return resultSet;
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
      if (fullObject.hasOwnProperty(cur)) {
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
