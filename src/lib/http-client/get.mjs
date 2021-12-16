import { config } from "../config.mjs";
import { parseSelect } from "../query-parser.mjs";
import { http } from "./http.mjs";
import { createReturnStructure } from "../create-return-structure.mjs";

export async function getEntities(query, data, addons = {}) {
  const { queryParser, resultSetFilter } = addons;
  const { fields, entities, conditions } = queryParser(parseSelect(query));

  const result = await Promise.all(
    entities.map((res) => {
      const path = getPath(conditions, res);
      return http.get(path, data);
    })
  );
  return createReturnStructure(result, entities, fields, conditions, resultSetFilter);
}

function getPath(conditions = {}, res) {
  const nestedRoute = config.getNestedRoute(res, conditions);
  if (nestedRoute) {
    return nestedRoute;
  } else if (conditions.value) {
    return `${res}/${conditions.value}`;
  } else {
    return res;
  }
}
