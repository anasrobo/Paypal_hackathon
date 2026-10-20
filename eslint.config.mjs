import { dirname } from "path";
import { fileURLToPath } from "url";
import { FlatCompat } from "@eslint/eslintrc";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const compat = new FlatCompat({
  baseDirectory: __dirname,
});

const eslintConfig = [
  ...compat.extends("next/core-web-vitals", "next/typescript"),
  {
    ignores: [
      "node_modules/**",
      ".next/**",
      "out/**",
      "build/**",
      "next-env.d.ts",
      "playwright-report/**",
      "test-results/**",
      "docs/research/**",
    ],
  },

  // ---------------------------------------------------------------------------
  // The domain purity rule.
  //
  // src/domain holds the state machine and the verification gate. They must
  // stay pure — no I/O, no clock, no environment, no database, no framework —
  // because that is what makes the money-safety rules provable and unit
  // testable in milliseconds.
  //
  // This is enforced here rather than trusted to discipline.
  // ---------------------------------------------------------------------------
  {
    files: ["src/domain/**/*.ts", "src/ops/**/*.ts"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: [
                "@/server/*",
                "@/server/**",
                "@/app/*",
                "@/app/**",
                "@/components/*",
                "@/components/**",
                "next",
                "next/*",
                "react",
                "react-dom",
                "react/*",
                "node:*",
                "postgres",
                "zod",
              ],
              message:
                "src/domain and src/ops are PURE. No server, framework, node, database or env imports. " +
                "Move the side effect behind src/server and pass the value in.",
            },
          ],
        },
      ],
    },
  },
];

export default eslintConfig;
