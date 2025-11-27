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

function getRequestDetails(url) {
  const customPath = config.path.hasOwnProperty(url);
  const host = standardiseEndSlash((customPath && customPath.url) || config.apiUrl);
  const options = (customPath && customPath.options) || config.options;
  return { host, options };
}

function preparePaginationData(url, data, host) {
  if (!config.hasPagination()) {
    return { finalData: data };
  }
  const paginationParam = config.getPaginationParamName();
  const qs = objectToQueryParams(data || {});
  const baseUrl = `${host}/${url}`;
  const paginationKey = config.buildPaginationKey(baseUrl, qs, paginationParam);
  const state = config.getPaginationState(paginationKey);
  const token = state && state.token;
  const finalData = token ? { ...(data || {}), [paginationParam]: token } : data;
  return { finalData, paginationKey, paginationParam, token };
}

function buildRequestOptions({ url, method, data, finalData, host, options, pagination, isGetData }) {
  const qs = isGetData ? objectToQueryParams(finalData || {}) : "";
  const fullUrl = `${host}/${url}${qs ? `?${qs}` : ""}`;
  const opts = {
    method,
    url: fullUrl,
    json: true,
    ...(!isGetData ? { body: data } : {}),
    ...options
  };

  if (pagination && pagination.paginationKey) {
    opts.__paginationKey = pagination.paginationKey;
    opts.__paginationParam = pagination.paginationParam;
    // Mark whether a token was applied and include a masked preview for debug
    if (pagination.token) {
      const t = String(pagination.token);
      const masked = t.length <= 6 ? "***" : `${t.slice(0, 3)}***${t.slice(-3)}`;
      opts.__paginationApplied = true;
      opts.__paginationTokenPreview = masked;
    } else {
      opts.__paginationApplied = false;
    }
  }
  return opts;
}

function getRequester(opts) {
  const useNodeProvider = isNode && config.hasNodeProvider();
  return useNodeProvider ? getNodeRequesterWrapper(getNodeProvider(opts)) : fetchRequest;
}

function executeRequestWithPolicy(requester, opts, url) {
  const executor = () => requester(opts, 0, config, url);
  return config.hasPolicy(url) ? config.getPolicy(url).execute(executor) : executor();
}

function run(url, method, data) {
  const isGetData = method === "GET";
  const { host, options } = getRequestDetails(url);

  const pagination = isGetData ? preparePaginationData(url, data, host) : {};
  const finalData = pagination.finalData || data;

  const opts = buildRequestOptions({
    url,
    method,
    data,
    finalData,
    host,
    options,
    pagination,
    isGetData
  });

  const requester = getRequester(opts);
  return executeRequestWithPolicy(requester, opts, url);
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

function getNodeRequesterWrapper(provider) {
  // provider is a function that accepts (opts, iterations, config, url) and returns a Promise<{status, data}>
  return async function (opts, iterations = 0, conf, url) {
    try {
      const res = await provider(opts, iterations, conf, url);
      // Optional debug of raw response for node provider
      logDebugResponse(opts, res?.data, res?.headers);
      if (conf?.hasPagination && conf.hasPagination() && opts.__paginationKey) {
        const processed = applyPaginationPostProcessing(opts, res.data, res.data, res.headers);
        return { ...res, data: processed };
      }
      return res;
    } catch (err) {
      // Fallback to fetch-based path in case provider fails (e.g., JSON parse error)
      try {
        return await fetchRequest(opts, iterations, conf, url);
      } catch (_) {
        throw err;
      }
    }
  };
}

function applyPaginationPostProcessing(opts, rawData, extractedData, headers) {
  try {
    const key = opts.__paginationKey;
    const param = opts.__paginationParam;
    const prev = config.getPaginationState(key);
    const nextToken = config.extractNextToken(rawData, extractedData, headers);
    if (nextToken) {
      config.setPaginationState(key, { token: nextToken, hasMore: true, param });
      if (config.hasDebug()) {
        const t = String(nextToken);
        const masked = t.length <= 6 ? "***" : `${t.slice(0, 3)}***${t.slice(-3)}`;
        console.log("[querty][debug] pagination: stored next token", { key, param, token: masked });
      }
      return extractedData;
    }
    // No next token found
    if (prev && prev.token) {
      if (config.hasDebug()) {
        console.log("[querty][debug] pagination: end of pages (clearing state)", { key, param });
      }
      // We were paginating; end of pages -> clear and return empty array
      config.clearPaginationState(key);
      return Array.isArray(extractedData) ? [] : [];
    }
    // Not paginating or initial page without token; do nothing
    return extractedData;
  } catch (_) {
    return extractedData;
  }
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
  const pagination = opts.__paginationKey
    ? {
        key: opts.__paginationKey,
        param: opts.__paginationParam,
        applied: Boolean(opts.__paginationApplied),
        token: opts.__paginationTokenPreview || undefined
      }
    : undefined;
  console.log("[querty][debug] api request:", {
    url: opts.url,
    options: debugOptions,
    ...(pagination ? { pagination } : {})
  });
}

function logDebugResponse(opts, raw, headers) {
  if (!config.hasDebug() || !config.hasDebugResponseRaw()) return;
  let safeHeaders = headers;
  try {
    if (headers && typeof headers.entries === "function") {
      // Convert Headers to plain object for logging
      const obj = {};
      for (const [k, v] of headers.entries()) obj[k] = v;
      safeHeaders = obj;
    }
  } catch (_) {
    // noop
  }
  console.log("[querty][debug] api response:", {
    url: opts.url,
    status: undefined,
    headers: safeHeaders,
    raw
  });
}

function getFetchOptions(opts) {
  let controller, signal;
  if (config.hasCancel()) {
    controller = new AbortController();
    signal = controller.signal;
    config.cancel = controller;
  }
  return {
    method: opts.method,
    ...(signal ? { signal } : {}),
    ...(opts.body ? { body: JSON.stringify(opts.body) } : {}),
    ...(opts.headers ? { headers: opts.headers } : {})
  };
}

async function handleSuccessfulResponse(response, opts) {
  const rawJson = response.status === 204 ? {} : await response.json();
  // Optional debug of raw response
  logDebugResponse(opts, rawJson, response.headers);
  let extracted = config.dataExtractor(rawJson);
  // Pagination handling (web fetch has headers)
  if (config.hasPagination() && opts.__paginationKey) {
    extracted = applyPaginationPostProcessing(opts, rawJson, extracted, response.headers);
  }
  return {
    status: response.status,
    data: extracted
  };
}

async function fetchRequest(opts, iterations = 0, _, url) {
  const fetchOptions = getFetchOptions(opts);
  debugFetch(fetchOptions, opts);
  const response = await fetch(opts.url, fetchOptions);

  if (shouldCheckRefreshToken(response.status, iterations)) {
    const newOpts = await tryRefreshToken(opts, url);
    return fetchRequest(newOpts, 1, _, url);
  }

  return handleSuccessfulResponse(response, opts);
}

function shouldCheckRefreshToken(statusCode, iterations) {
  return statusCode === 401 && iterations === 0 && config.hasRefresh();
}
