import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const cleanCodeRules = {
  complexity: ["error", 10],
  "max-params": ["error", 3],
  "max-depth": ["error", 4],
  "max-statements": ["error", 20],
  "max-statements-per-line": ["error", { max: 1 }],
  "max-nested-callbacks": ["error", 3],
  "max-lines-per-function": [
    "error",
    { max: 60, skipBlankLines: true, skipComments: true, IIFEs: true },
  ],
  "max-lines": [
    "error",
    { max: 400, skipBlankLines: true, skipComments: true },
  ],
  "array-callback-return": ["error", { checkForEach: true }],
  "no-eval": "error",
  "no-implied-eval": "error",
  "no-return-assign": ["error", "except-parens"],
  "no-unreachable": "error",
  "no-constant-condition": "error",
  "no-implicit-coercion": [
    "error",
    { boolean: true, number: true, string: true },
  ],
  "no-nested-ternary": "error",
  "no-else-return": ["error", { allowElseIf: false }],
  "prefer-const": "error",
  "no-var": "error",
  eqeqeq: ["error", "always", { null: "ignore" }],
  curly: ["error", "all"],
  "default-param-last": "error",
  "no-useless-return": "error",
  "object-shorthand": ["error", "always"],
  "prefer-template": "error",
  "no-param-reassign": ["error", { props: false }],
  "prefer-destructuring": ["error", { object: true, array: false }],
  "@typescript-eslint/no-unused-vars": [
    "error",
    { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
  ],
  "@typescript-eslint/no-explicit-any": "error",
  "@typescript-eslint/consistent-type-imports": [
    "error",
    { prefer: "type-imports", fixStyle: "inline-type-imports" },
  ],
};

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  globalIgnores([".next/**", "out/**", "build/**", "next-env.d.ts"]),
  {
    rules: cleanCodeRules,
  },
  {
    files: ["**/*.{ts,tsx}"],
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      "@typescript-eslint/prefer-optional-chain": "error",
      "@typescript-eslint/prefer-nullish-coalescing": "error",
    },
  },
  {
    files: ["**/*.test.{ts,tsx}", "test/**/*.ts"],
    rules: {
      "max-lines-per-function": [
        "error",
        { max: 135, skipBlankLines: true, skipComments: true, IIFEs: true },
      ],
      "max-lines": [
        "error",
        { max: 600, skipBlankLines: true, skipComments: true },
      ],
      "no-nested-ternary": "off",
    },
  },
  {
    files: ["scripts/**/*.mjs"],
    rules: {
      complexity: ["error", 15],
      "max-lines-per-function": [
        "error",
        { max: 80, skipBlankLines: true, skipComments: true, IIFEs: true },
      ],
    },
  },
  {
    files: ["**/*.config.{mjs,ts}"],
    rules: {
      "max-lines": "off",
    },
  },
]);

export default eslintConfig;
