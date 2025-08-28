import { config } from "../config.mjs";
import { isNodejs } from "../is-node.mjs";
import objectToQueryParams from "object-to-query-params";
import { standardiseEndSlash } from "../standardise-end-slash.mjs";

const isNode = isNodejs();

export const http = {
  get(url, data) {
    return run(url, "GET", data);
  },
  put(url, data) {
    return run(url, "PUT", data);
  },
  post(url, data) {
    return run(url, "POST", data);
  },
  delete(url) {
    return run(url, "DELETE");
  }
};

function run(url, method, data) {
  const isGetData = data && method === "GET";
  const customPath = config.path.hasOwnProperty(url);
  const host = standardiseEndSlash((customPath && customPath.url) || config.apiUrl);
  const options = (customPath && customPath.options) || config.options;
  const opts = {
    method,
    url: `${host}/${url}${isGetData ? `?${objectToQueryParams(data)}` : ""}`,
    json: true,
    ...(!isGetData ? { body: data } : {}),
    ...options
  };

  const useNodeProvider = isNode && config.hasNodeProvider();
  const requester = useNodeProvider ? getNodeProvider(opts) : fetchRequest;

  return config.hasPolicy(url)
    ? config.getPolicy(url).execute(() => requester(opts, 0, config, url))
    : requester(opts, 0, config, url);
}

async function tryRefreshToken(opts, url) {
  await config.refresh(url);
  const customPath = config.path.hasOwnProperty(url);
  const options = (customPath && customPath.options) || config.options;
  return {
    ...opts,
    headers: options.headers
  };
}

function getNodeProvider(opts) {
  if (config.hasDebug()) {
    const debugOptions = {
      method: opts.method,
      ...(opts.body ? { body: JSON.stringify(opts.body) } : {}),
      ...(opts.headers ? { headers: opts.headers } : {})
    };
    logDebug(opts, debugOptions);
  }
  return config.getNodeProvider();
}

function debugFetch(fetchOptions, opts) {
  if (config.hasDebug()) {
    // Log a safe, serializable snapshot of the fetch request options
    const debugOptions = { ...fetchOptions };
    if (debugOptions.signal) {
      debugOptions.signal = "[AbortSignal]";
    }
    logDebug(opts, debugOptions);
  }
}

function logDebug(opts, debugOptions) {
  console.log("[querty][debug] api request:", { url: opts.url, options: debugOptions });
}

async function fetchRequest(opts, iterations = 0, _, url) {
  let controller, signal;
  if (config.hasCancel()) {
    controller = new AbortController();
    signal = controller.signal;
    config.cancel = controller;
  }
  const fetchOptions = {
    method: opts.method,
    ...(signal ? { signal } : {}),
    ...(opts.body ? { body: JSON.stringify(opts.body) } : {}),
    ...(opts.headers ? { headers: opts.headers } : {})
  };
  debugFetch(fetchOptions, opts);
  const response = await fetch(opts.url, fetchOptions);

  if (shouldCheckRefreshToken(response.status, iterations)) {
    const newOpts = await tryRefreshToken(opts, url);
    return fetchRequest(newOpts, 1);
  } else {
    const data = await response.json();
    return {
      status: response.status,
      data: config.dataExtractor(data)
    };
  }
}

function shouldCheckRefreshToken(statusCode, iterations) {
  return statusCode === 401 && iterations === 0 && config.hasRefresh();
}
