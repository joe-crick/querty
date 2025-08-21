export function standardiseEndSlash(url) {
  return url && url.length > 1 && url.endsWith("/") ? url.slice(0, -1) : url;
}
