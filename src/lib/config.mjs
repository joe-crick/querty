import { cond } from "./cond.mjs";

let _config;
let _pagination = new Map(); // key -> { token: string|undefined, hasMore: boolean, param: string }

export function setConfig(conf) {
  _config = conf;
  // Reset pagination state on new config
  _pagination = new Map();
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
  hasDebug() {
    return Boolean(_config.debug);
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
  },
  // Pagination support
  hasPagination() {
    return Boolean(_config && _config.paginationToken);
  },
  getPaginationSpec() {
    return _config.paginationToken || {};
  },
  getPaginationParamName() {
    const spec = this.getPaginationSpec();
    return spec.param || spec.requestParam || "paginationToken";
  },
  // Build a stable key for a request form (endpoint + query excluding pagination param)
  buildPaginationKey(baseUrl, queryString, paramName) {
    if (!queryString) return baseUrl;
    // Remove pagination token param from key
    const parts = queryString.split("&").filter((p) => !p.startsWith(`${paramName}=`));
    parts.sort(); // ensure deterministic ordering
    const qs = parts.join("&");
    return qs ? `${baseUrl}?${qs}` : baseUrl;
  },
  getPaginationState(key) {
    return _pagination.get(key);
  },
  setPaginationState(key, state) {
    _pagination.set(key, state);
  },
  clearPaginationState(key) {
    _pagination.delete(key);
  },
  hasMore(key) {
    const s = _pagination.get(key);
    return Boolean(s && s.hasMore);
  },
  extractNextToken(rawData, extractedData, headers) {
    const spec = this.getPaginationSpec();
    const getter = (obj, path) => {
      if (!obj || !path) return undefined;
      const segs = path.split(".");
      let cur = obj;
      for (let i = 0; i < segs.length; i++) {
        const k = segs[i];
        if (cur && Object.prototype.hasOwnProperty.call(cur, k)) {
          cur = cur[k];
        } else {
          return undefined;
        }
      }
      return cur;
    };
    if (typeof spec.responsePath === "function") {
      // Support multiple invocation styles for maximum compatibility
      try {
        const fn = spec.responsePath;
        const safe = (call) => {
          try {
            return call();
          } catch {
            return undefined;
          }
        };
        // prettier-ignore
        const primary = cond(
          fn.length === 1, () => fn({ data: rawData, extracted: extractedData, headers }),
          fn.length === 2, () => fn(rawData, headers),
          cond.ELSE, () => fn(rawData, extractedData, headers)
        )();
        if (primary !== undefined) return primary;
        // Fallback attempts if undefined returned
        const alt1 = safe(() => fn(rawData, headers));
        if (alt1 !== undefined) return alt1;
        const alt2 = safe(() => fn(rawData, extractedData, headers));
        if (alt2 !== undefined) return alt2;
        const alt3 = safe(() => fn({ data: rawData, extracted: extractedData, headers }));
        if (alt3 !== undefined) return alt3;
        return undefined;
      } catch {
        return undefined;
      }
    }
    let token;
    if (spec.responseHeader && headers && typeof headers.get === "function") {
      token = headers.get(spec.responseHeader);
      if (token) return token;
    }
    if (spec.responsePath) {
      token = getter(rawData, spec.responsePath);
      if (token == null && extractedData && extractedData !== rawData) {
        token = getter(extractedData, spec.responsePath);
      }
    }
    return token;
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
