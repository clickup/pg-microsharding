"use strict";
const config = require("../../.eslintrc.client.base.js")(__dirname);
config.rules["import/no-extraneous-dependencies"] = "error";
config.rules["@typescript-eslint/explicit-function-return-type"] = [
  "error",
  { allowExpressions: true },
];
module.exports = config;
