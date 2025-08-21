let _config;

export function setConfig(conf) {
  _config = conf;
}

let addons;

export const config = {
  get apiUrl() {
    return _config.apiUrl;
  },
  get options() {
    return _config.options || {};
  },
  // enable support for nested routes; the user can provide pathing templates.
  getNestedRoute(entity, conditions) {
    if (_config?.pathMap) {
      const nestedPath = _config.pathMap[entity];
      return nestedPath ? parseNestedRoute(nestedPath, conditions) : nestedPath;
    }
    return undefined;
  },
  // enable the end user to determine how they want to extract the data of their api requests.
  // by default, just return the data
  dataExtractor(data) {
    return _config.dataExtractor ? _config.dataExtractor(data) : data;
  },
  // the end user can supply a `refresh` function that will run if the http client encounters a 401
  // the end user can, then, attempt to obtain new access and refresh tokens and supply them to dal.
  refresh(url) {
    _config.refresh(url).then((data) => {
      _config.options.headers = data;
    });
  },
  hasRefresh() {
    return _config.hasOwnProperty("refresh");
  },
  getPolicy(entity) {
    return entity && _config[entity]?.policy ? _config[entity].policy : _config.policy;
  },
  hasPolicy(entity) {
    const policy = "policy";
    return (_config[entity] && _config[entity].hasOwnProperty(policy)) || _config.hasOwnProperty(policy);
  },
  hasCancel() {
    return _config.canCancel;
  },
  set cancel(controller) {
    _config.cancelController = controller;
  },
  hasNodeProvider() {
    return _config.hasOwnProperty("nodeProvider");
  },
  getNodeProvider() {
    return _config.nodeProvider;
  },
  hasAddons() {
    return _config.hasOwnProperty("addons");
  },
  getAddons() {
    if (!addons) {
      addons = _config.addons.map((addon) => {
        addon.queryParser = addon.queryParser.bind(addon);
        addon.resultSetFilter = addon.resultSetFilter.bind(addon);
        return addon;
      });
    }
    return addons || [];
  },
  get path() {
    return _config.path || { url: "", config: {} };
  }
};

function parseNestedRoute(nestedPath, conditions) {
  if (!conditions) {
    throw new Error("You cannot query a nested route without a conditional clause (e.g., WHERE clause)");
  }
  const slugs = getSlugs(nestedPath);
  return slugs.reduce((acc, cur) => {
    return acc.replace(`{${cur}}`, conditions[cur]);
  }, nestedPath);
}

const matchSlugs = /{(.*?)}/g;
const curlyBraces = /[{}]/g;

function getSlugs(nestedPath) {
  const slugs = nestedPath.match(matchSlugs) || [nestedPath];
  return slugs.map((item) => item.replace(curlyBraces, ""));
}
