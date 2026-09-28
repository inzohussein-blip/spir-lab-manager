import coreWebVitals from "eslint-config-next/core-web-vitals";
import typescript from "eslint-config-next/typescript";

const config = [
  ...coreWebVitals,
  ...typescript,
  { ignores: [".next/**", "node_modules/**", "tests/**", "public/sw.js"] },
  {
    rules: {
      // Pages read what the device saved (localStorage / IndexedDB) after they open, so the server
      // and the first render match; setting that state inside an effect is on purpose here.
      "react-hooks/set-state-in-effect": "warn",
      // Database rows read with `any` in the admin panel's pages; shown, not errors.
      "@typescript-eslint/no-explicit-any": "warn",
      // `_name` marks a value left out on purpose (e.g. `const { secret: _s, ...rest } = row`).
      "@typescript-eslint/no-unused-vars": ["warn", { argsIgnorePattern: "^_", varsIgnorePattern: "^_", ignoreRestSiblings: true }],
      // `ok && doIt()` and `cond ? a() : b()` as statements.
      "@typescript-eslint/no-unused-expressions": ["warn", { allowShortCircuit: true, allowTernary: true }],
    },
  },
];
export default config;
