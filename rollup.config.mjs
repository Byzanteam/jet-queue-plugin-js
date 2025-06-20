import { defineConfig } from "rollup";
import typescript from "@rollup/plugin-typescript";
import { dts } from "rollup-plugin-dts";

export default defineConfig([
  {
    input: "src/index.ts",
    output: {
      dir: "dist",
      format: "esm",
    },
    plugins: [
      typescript({
        module: "esnext",
        moduleResolution: "bundler",
        strict: true,
        target: "esnext",
      }),
    ],
  },
  {
    input: "src/index.ts",
    output: {
      dir: "dist",
      format: "esm",
    },
    plugins: [
      dts(),
    ],
  },
]);
