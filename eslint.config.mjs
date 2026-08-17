import nextCoreWebVitals from "eslint-config-next/core-web-vitals";
import nextTypescript from "eslint-config-next/typescript";

/**
 * Flat ESLint config.
 *
 * The legacy modules (5S and Gemba front-ends, and the Project Management
 * prototype markup) are pre-existing single-file apps that predate this
 * codebase. They are excluded so the lint gate stays meaningful for new code;
 * modernising them is tracked in SECURITY.md.
 */
const eslintConfig = [
  {
    ignores: [
      "public/**",
      "src/app/app/legacy-markup.ts",
      ".next/**",
      "node_modules/**",
      "next-env.d.ts",
    ],
  },
  ...nextCoreWebVitals,
  ...nextTypescript,
  {
    // Matched with a plain `**` glob rather than a `src/`-prefixed one: the
    // prefixed form silently fails to match on Windows checkouts whose path
    // contains spaces or non-ASCII characters, which quietly disabled this rule
    // locally while CI still enforced it. Scope stays correct because lint is
    // invoked as `eslint src` and the ignores above exclude the legacy apps.
    files: ["**/*.ts", "**/*.tsx"],
    rules: {
      // Identifier structure is machine-enforced here. Whether a name is
      // meaningful English is enforced by CODE_QUALITY.md and agent review.
      "@typescript-eslint/naming-convention": [
        "error",
        {
          selector: "default",
          format: ["camelCase"],
          leadingUnderscore: "allow",
          trailingUnderscore: "allow",
        },
        {
          selector: "variable",
          format: ["camelCase", "PascalCase", "UPPER_CASE"],
          leadingUnderscore: "allow",
          trailingUnderscore: "allow",
        },
        {
          // React components are PascalCase, and the App Router requires route
          // handlers to be named after the HTTP verb (GET, POST, ...). Both are
          // framework-mandated, so the rule must permit them.
          selector: "function",
          format: ["camelCase", "PascalCase", "UPPER_CASE"],
          leadingUnderscore: "allow",
        },
        {
          // Imported names are chosen by the package (Link, Script, NextResponse).
          selector: "import",
          format: ["camelCase", "PascalCase", "UPPER_CASE"],
        },
        {
          selector: "typeLike",
          format: ["PascalCase"],
        },
        {
          selector: ["objectLiteralProperty", "typeProperty"],
          format: null,
        },
        {
          selector: "variable",
          modifiers: ["destructured"],
          format: null,
        },
      ],
    },
  },
];

export default eslintConfig;
