export function isNodejs() {
  return (
    typeof process === "object" && typeof process.versions === "object" && typeof process.versions.node !== "undefined"
  );
}
