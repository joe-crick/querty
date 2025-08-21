import { config } from "./config.mjs";
import { compose } from "./compose";

export function getAddonParsers() {
  let queryParser = (i) => i;
  let resultSetFilter = (i) => i;
  if (config.hasAddons()) {
    const { queryParsers, resultSetFilters } = config.getAddons().reduce(
      (acc, { queryParser, resultSetFilter }) => {
        acc.queryParsers.push(queryParser);
        acc.resultSetFilters.push(resultSetFilter);
        return acc;
      },
      { queryParsers: [], resultSetFilters: [] }
    );
    queryParser = compose(...queryParsers);
    resultSetFilter = compose(...resultSetFilters);
  }
  return { queryParser, resultSetFilter };
}
