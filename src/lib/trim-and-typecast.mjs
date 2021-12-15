export function trimAndTypecast(item) {
  item = item.trim();
  if (item.includes("'")) {
    return item.replace(/'/g, "");
  } else if (item === "true" || item === "false") {
    return Boolean(item);
  } else if (!isNaN(item)) {
    return Number(item);
  } else if (item.startsWith("[") || item.startsWith("{")) {
    return JSON.parse(item);
  } else {
    return item;
  }
}
