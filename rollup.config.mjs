import { defineConfig } from "rollup";
import typescript from "@rollup/plugin-typescript";
import { dts } from "rollup-plugin-dts";

const tsPlugin = typescript({
  module: "esnext",
  moduleResolution: "bundler",
  strict: true,
  target: "esnext",
});

export default defineConfig([
  {
    input: ["src/index.ts", "src/testing.ts"],
    output: {
      dir: "dist",
      format: "esm",
    },
    plugins: [tsPlugin],
  },
  {
    input: "src/index.ts",
    output: {
      file: "dist/index.d.ts",
      format: "esm",
    },
    plugins: [dts()],
  },
  {
    input: "src/testing.ts",
    output: {
      file: "dist/testing.d.ts",
      format: "esm",
    },
    plugins: [dts()],
  },
]);
