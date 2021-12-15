import {parseUpdate} from "../query-parser.mjs";
import {http} from "./http.mjs";

export async function updateEntity(query, data) {
  const result = {};
  const { entity, queryData, id } = getPayload(data, query);

  const newEntity = await http.put(`${entity}/${id}`, queryData);
  result[entity] = newEntity.data;

  return result;
}

function getPayload(data, query) {
  let entity, queryData, id;
  if (data) {
    const [, resource, idSet] = query.split(/UPDATE\b|\bWHERE\b/i);
    id = idSet.split("=")[1].trim();
    entity = resource.trim();
    queryData = data;
  } else {
    const parsed = parseUpdate(query);
    entity = parsed.entity;
    queryData = parsed.data;
    id = parsed.id;
  }
  return { entity, queryData, id };
}
