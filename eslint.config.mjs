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
    }
  },
  pluginJs.configs.recommended,
];
