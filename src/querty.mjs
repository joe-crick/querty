import { commandMap } from "./lib/command-map.mjs";
import { getSqlCommand } from "./lib/get-sql-command.mjs";
import { removeEntity } from "./lib/http-client/delete.mjs";
import { getEntities } from "./lib/http-client/get.mjs";
import { createEntity } from "./lib/http-client/post.mjs";
import { updateEntity } from "./lib/http-client/put.mjs";

export { setConfig } from "./lib/config.mjs";

const methodMap = {
  [commandMap.select]: getEntities,
  [commandMap.insert]: createEntity,
  [commandMap.update]: updateEntity,
  [commandMap.delete]: removeEntity
};

export async function exec(query, data) {
  const [sqlCommand] = getSqlCommand(query);
  const cmd = commandMap[sqlCommand.toLowerCase()];

  return methodMap[cmd](query, data);
}
