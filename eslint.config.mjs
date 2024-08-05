import globals from "globals";
import pluginJs from "@eslint/js";

export default [
  {
    languageOptions: {
      globals: {
        ...globals.browser,
        ...globals.webextensions,
      }
    },
    rules: {
      "no-var": "warn",
      "prefer-const": "warn",
    }
  },
  pluginJs.configs.recommended,
];
