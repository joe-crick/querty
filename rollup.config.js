import babel from "@rollup/plugin-babel";
import commonjs from "@rollup/plugin-commonjs";
import resolve from "@rollup/plugin-node-resolve";
import { enableDevPlugins } from "./enableDevPlugins.js";
import terser from "@rollup/plugin-terser";

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
          "@babel/plugin-transform-object-rest-spread",
          "@babel/plugin-transform-optional-chaining",
          "@babel/plugin-syntax-dynamic-import",
          "@babel/plugin-transform-class-properties",
          "@babel/plugin-transform-runtime"
        ],
        exclude: ["node_modules/**", "lib", "bin"],
        babelrc: false,
        babelHelpers: 'runtime'
      }),
      commonjs(),
      terser()
    ]
  }
];
