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
];

export default eslintConfig;
