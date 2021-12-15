import { http } from "./http.mjs";

export async function removeEntity(query) {
  const parsed = query.split(" ");
  const table = parsed[2];
  const idSet = parsed[4];
  const id = idSet.split("=")[1].trim();

  await http.delete(`${table}/${id}`);

  return { id };
}
