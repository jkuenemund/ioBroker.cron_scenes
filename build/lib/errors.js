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
var errors_exports = {};
__export(errors_exports, {
  CRON_ERROR_CODE: () => import_constants.CRON_ERROR_CODE,
  CronJobError: () => CronJobError
});
module.exports = __toCommonJS(errors_exports);
var import_constants = require("./constants");
class CronJobError extends Error {
  constructor(message, jobId, code, originalError) {
    super(message);
    this.jobId = jobId;
    this.code = code;
    this.originalError = originalError;
    this.name = "CronJobError";
  }
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  CRON_ERROR_CODE,
  CronJobError
});
//# sourceMappingURL=errors.js.map
