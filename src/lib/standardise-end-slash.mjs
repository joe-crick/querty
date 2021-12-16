export function standardiseEndSlash(url) {
    return url.endsWith("/") ? url.substr(0, url.length - 1) : url;
}
