import babel from "rollup-plugin-babel";
import commonjs from "rollup-plugin-commonjs";
import resolve from "rollup-plugin-node-resolve";
import { enableDevPlugins } from "./enableDevPlugins";
import { terser } from "rollup-plugin-terser";

export default [
  {
    input: "src/querty.mjs",
    output: [
      {
        file: "dist/index.js",
        format: "esm",
        sourcemap: false
      }
    ],
    plugins: [
      ...enableDevPlugins(),
      resolve({
        preferBuiltins: true
      }),
      babel({
        plugins: [
          "@babel/plugin-proposal-object-rest-spread",
          "@babel/plugin-proposal-optional-chaining",
          "@babel/plugin-syntax-dynamic-import",
          "@babel/plugin-proposal-class-properties"
        ],
        exclude: ["node_modules/**", "lib", "bin"],
        babelrc: false
      }),
      commonjs(),
      terser()
    ],
    external: ["simple-get"]
  }
];
