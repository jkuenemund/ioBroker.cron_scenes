"use strict";
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);
var examples_exports = {};
__export(examples_exports, {
  EXAMPLE_JOBS: () => EXAMPLE_JOBS,
  createExampleJobConfig: () => createExampleJobConfig
});
module.exports = __toCommonJS(examples_exports);
var import_constants = require("./constants");
const EXAMPLE_JOBS = {
  recurring: {
    cron: "*/5 * * * *",
    // Every 5 minutes for demo
    targets: [
      {
        id: "cron_scenes.0.testVariable",
        type: "value",
        value: true,
        description: "Direct boolean value - executed immediately"
      },
      {
        id: "cron_scenes.0.testVariable2",
        type: "state",
        value: "cron_scenes.0.testVariable",
        description: "Copy value from another state",
        delay: 500
      },
      {
        id: "cron_scenes.0.testVariable3",
        type: "value",
        value: 42,
        description: "Set number value after 1 second delay",
        delay: 1e3
      }
    ],
    type: import_constants.CRON_JOB_TYPE.RECURRING
  },
  manual: {
    targets: [
      {
        id: "cron_scenes.0.testVariable",
        type: "value",
        value: false,
        description: "Manual trigger - set testVariable to false"
      },
      {
        id: "cron_scenes.0.testVariable",
        type: "value",
        value: true,
        description: "Manual trigger - set testVariable to true",
        delay: 250
      }
    ],
    type: import_constants.CRON_JOB_TYPE.MANUAL
  }
};
function createExampleJobConfig(type, active) {
  return {
    ...EXAMPLE_JOBS[type],
    active
  };
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  EXAMPLE_JOBS,
  createExampleJobConfig
});
//# sourceMappingURL=examples.js.map
