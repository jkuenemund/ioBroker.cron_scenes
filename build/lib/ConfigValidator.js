"use strict";
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
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
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);
var ConfigValidator_exports = {};
__export(ConfigValidator_exports, {
  ConfigValidator: () => ConfigValidator
});
module.exports = __toCommonJS(ConfigValidator_exports);
var cron = __toESM(require("node-cron"));
var import_constants = require("./constants");
var import_errors = require("./errors");
class ConfigValidator {
  /**
   * Validate a cron job configuration
   */
  static validateCronJobConfig(config, jobId) {
    if (!config || typeof config !== "object") {
      throw new import_errors.CronJobError("Configuration must be an object", jobId, import_constants.CRON_ERROR_CODE.CONFIG_INVALID);
    }
    const jobType = config.type || import_constants.CRON_JOB_TYPE.RECURRING;
    if (!Object.values(import_constants.CRON_JOB_TYPE).includes(jobType)) {
      throw new import_errors.CronJobError(
        `Invalid job type: ${jobType}. Must be one of: ${Object.values(import_constants.CRON_JOB_TYPE).join(", ")}`,
        jobId,
        import_constants.CRON_ERROR_CODE.CONFIG_INVALID
      );
    }
    if (jobType !== import_constants.CRON_JOB_TYPE.MANUAL) {
      if (!config.cron || typeof config.cron !== "string") {
        throw new import_errors.CronJobError(
          "Cron expression is required and must be a string for scheduled jobs",
          jobId,
          import_constants.CRON_ERROR_CODE.CONFIG_INVALID
        );
      }
      if (!cron.validate(config.cron)) {
        throw new import_errors.CronJobError(`Invalid cron expression: ${config.cron}`, jobId, import_constants.CRON_ERROR_CODE.INVALID_CRON);
      }
    }
    if (!Array.isArray(config.targets) || config.targets.length === 0) {
      throw new import_errors.CronJobError("Targets must be a non-empty array", jobId, import_constants.CRON_ERROR_CODE.CONFIG_INVALID);
    }
    const validatedTargets = config.targets.map((target, index) => {
      if (!target || typeof target !== "object") {
        throw new import_errors.CronJobError(`Target ${index} must be an object`, jobId, import_constants.CRON_ERROR_CODE.CONFIG_INVALID);
      }
      if (!target.id || typeof target.id !== "string") {
        throw new import_errors.CronJobError(
          `Target ${index} must have a valid 'id' property`,
          jobId,
          import_constants.CRON_ERROR_CODE.CONFIG_INVALID
        );
      }
      const targetType = target.type || import_constants.CRON_TARGET_TYPE.VALUE;
      if (!Object.values(import_constants.CRON_TARGET_TYPE).includes(targetType)) {
        throw new import_errors.CronJobError(
          `Target ${index} has invalid type '${target.type}'. Must be one of: ${Object.values(import_constants.CRON_TARGET_TYPE).join(", ")}`,
          jobId,
          import_constants.CRON_ERROR_CODE.CONFIG_INVALID
        );
      }
      if (targetType === import_constants.CRON_TARGET_TYPE.STATE) {
        if (typeof target.value !== "string") {
          throw new import_errors.CronJobError(
            `Target ${index} with type 'state' must have a string value (state ID)`,
            jobId,
            import_constants.CRON_ERROR_CODE.CONFIG_INVALID
          );
        }
      } else if (targetType === import_constants.CRON_TARGET_TYPE.VALUE) {
        const valueType = typeof target.value;
        if (!["string", "number", "boolean"].includes(valueType) && target.value !== null) {
          throw new import_errors.CronJobError(
            `Target ${index} with type 'value' must be string, number, boolean, or null`,
            jobId,
            import_constants.CRON_ERROR_CODE.CONFIG_INVALID
          );
        }
      }
      if (target.delay !== void 0) {
        if (typeof target.delay !== "number" || target.delay < 0 || target.delay > 6e4) {
          throw new import_errors.CronJobError(
            `Target ${index} delay must be a number between 0 and 60000 milliseconds`,
            jobId,
            import_constants.CRON_ERROR_CODE.CONFIG_INVALID
          );
        }
      }
      return {
        id: target.id,
        type: targetType,
        value: target.value,
        description: target.description || void 0,
        delay: target.delay || void 0
      };
    });
    if (typeof config.active !== "boolean") {
      throw new import_errors.CronJobError("Active flag must be a boolean", jobId, import_constants.CRON_ERROR_CODE.CONFIG_INVALID);
    }
    return {
      cron: jobType !== import_constants.CRON_JOB_TYPE.MANUAL ? config.cron : void 0,
      targets: validatedTargets,
      active: config.active,
      type: jobType
    };
  }
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  ConfigValidator
});
//# sourceMappingURL=ConfigValidator.js.map
