import { defineConfig } from "eslint/config";
import prettier from "eslint-plugin-prettier";
import jsdoc from "eslint-plugin-jsdoc";
import globals from "globals";
import path from "node:path";
import { fileURLToPath } from "node:url";
import js from "@eslint/js";
import { FlatCompat } from "@eslint/eslintrc";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const compat = new FlatCompat({
    baseDirectory: __dirname,
    recommendedConfig: js.configs.recommended,
    allConfig: js.configs.all
});

export default defineConfig([{
    extends: compat.extends(
        "eslint:recommended",
        "plugin:prettier/recommended",
        "plugin:jsdoc/recommended",
    ),

    plugins: {
        prettier,
        jsdoc,
    },

    languageOptions: {
        globals: {
            ...globals.browser,
            ...globals.mocha,
            ...globals.node,
            config: true,
            Log: true,
            MM: true,
            Module: true,
            moment: true,
        },

        ecmaVersion: 2017,
        sourceType: "module",

        parserOptions: {
            ecmaFeatures: {
                globalReturn: true,
            },
        },
    },

    rules: {
        "prettier/prettier": "error",
        eqeqeq: "error",
        "no-prototype-builtins": "off",
        "no-unused-vars": "off",
    },
}]);