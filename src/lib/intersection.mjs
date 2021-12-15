export function intersection(...rest) {
  return rest.length === 1
    ? rest[0]
    : rest.reduce((acc, cur) => {
        const comparison = new Set(cur);
        return [...new Set(acc)].filter((x) => comparison.has(x));
      });
}
