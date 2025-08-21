import { http } from "./http.mjs";
import { parseDelete } from "../query-parser.mjs";

export async function removeEntity(query) {
  const { entity, id } = parseDelete(query);

  await http.delete(`${entity}/${id}`);

  return { id };
}
