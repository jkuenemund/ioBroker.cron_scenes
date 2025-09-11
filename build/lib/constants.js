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
var constants_exports = {};
__export(constants_exports, {
  CRON_ERROR_CODE: () => CRON_ERROR_CODE,
  CRON_JOB_STATUS: () => CRON_JOB_STATUS,
  CRON_JOB_TYPE: () => CRON_JOB_TYPE,
  CRON_TARGET_TYPE: () => CRON_TARGET_TYPE
});
module.exports = __toCommonJS(constants_exports);
const CRON_JOB_STATUS = {
  SUCCESS: "success",
  ERROR: "error",
  PENDING: "pending"
};
const CRON_JOB_TYPE = {
  ONCE: "once",
  RECURRING: "recurring",
  MANUAL: "manual"
};
const CRON_TARGET_TYPE = {
  VALUE: "value",
  STATE: "state"
};
const CRON_ERROR_CODE = {
  INVALID_CRON: "INVALID_CRON",
  TARGET_NOT_FOUND: "TARGET_NOT_FOUND",
  EXECUTION_FAILED: "EXECUTION_FAILED",
  CONFIG_INVALID: "CONFIG_INVALID"
};
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  CRON_ERROR_CODE,
  CRON_JOB_STATUS,
  CRON_JOB_TYPE,
  CRON_TARGET_TYPE
});
//# sourceMappingURL=constants.js.map
