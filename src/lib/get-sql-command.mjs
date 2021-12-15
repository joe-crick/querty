const commas = /,/gi;

export function getSqlCommand(query) {
  return query.replace(commas, "").split(" ");
}
