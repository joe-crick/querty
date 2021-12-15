import {parseInsert} from "../query-parser.mjs";
import {http} from "./http.mjs";

export async function createEntity(query, data) {
  const result = {};
  const { entity, queryData } = getPayload(data, query);

  const newEntity = await http.post(entity, queryData);

  if (result[entity]) {
    result[entity].push(newEntity.data);
  } else {
    result[entity] = [newEntity.data];
  }

  return result;
}

function getPayload(data, query) {
  let entity, queryData;
  if (data) {
    entity = query.replace(/INSERT INTO/i, "").trim();
    queryData = data;
  } else {
    const parsed = parseInsert(query);
    entity = parsed.entity;
    queryData = parsed.data;
  }
  return { entity, queryData };
}
