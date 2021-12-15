import analyze from "rollup-plugin-analyzer";

const enableDevPlugins = () => {
  const plugins = [];
  if (process.env.ANALYZE && JSON.parse(process.env.ANALYZE)) {
    plugins.push(analyze());
  }
  return plugins;
};

export { enableDevPlugins };
