import { config } from "../config.mjs";
import { isNodejs } from "../is-node.mjs";
import objectToQueryParams from "object-to-query-params";

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
  const opts = {
    method,
    url: `${config.apiUrl}/${url}${isGetData ? `?${objectToQueryParams(data)}` : ""}`,
    json: true,
    ...(!isGetData ? { body: data } : {}),
    ...config.options
  };

  const requester = isNode && config.hasNodeProvider() ? config.getNodeProvider() : fetchRequest;
  return config.hasPolicy(url) ? config.getPolicy(url).execute(() => requester(opts, 0, config)) : requester(opts, 0, config);
}

async function tryRefreshToken(opts) {
  await config.refresh();
  return {
    ...opts,
    headers: config.options.headers
  };
}

async function fetchRequest(opts, iterations = 0) {
  let controller, signal;
  if (config.hasCancel()) {
    controller = new AbortController();
    signal = controller.signal;
    config.cancel = controller;
  }
  const response = await fetch(opts.url, {
    method: opts.method,
    ...(signal ? { signal } : {}),
    ...(opts.body ? { body: JSON.stringify(opts.body) } : {}),
    ...(opts.headers ? { headers: opts.headers } : {})
  });

  if (shouldCheckRefreshToken(response.status, iterations)) {
    const newOpts = await tryRefreshToken(opts);
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
