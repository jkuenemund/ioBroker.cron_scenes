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
var CronJobManager_exports = {};
__export(CronJobManager_exports, {
  CRON_ERROR_CODE: () => CRON_ERROR_CODE,
  CRON_JOB_STATUS: () => CRON_JOB_STATUS,
  CRON_JOB_TYPE: () => CRON_JOB_TYPE,
  CRON_TARGET_TYPE: () => CRON_TARGET_TYPE,
  ConfigValidator: () => ConfigValidator,
  CronJobError: () => CronJobError,
  CronJobManager: () => CronJobManager
});
module.exports = __toCommonJS(CronJobManager_exports);
var cron = __toESM(require("node-cron"));
const CRON_JOB_STATUS = {
  SUCCESS: "success",
  ERROR: "error",
  PENDING: "pending"
};
const CRON_JOB_TYPE = {
  ONCE: "once",
  RECURRING: "recurring"
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
class CronJobError extends Error {
  constructor(message, jobId, code, originalError) {
    super(message);
    this.jobId = jobId;
    this.code = code;
    this.originalError = originalError;
    this.name = "CronJobError";
  }
}
class ConfigValidator {
  /**
   * Validate a cron job configuration
   */
  static validateCronJobConfig(config, jobId) {
    if (!config || typeof config !== "object") {
      throw new CronJobError("Configuration must be an object", jobId, CRON_ERROR_CODE.CONFIG_INVALID);
    }
    if (!config.cron || typeof config.cron !== "string") {
      throw new CronJobError(
        "Cron expression is required and must be a string",
        jobId,
        CRON_ERROR_CODE.CONFIG_INVALID
      );
    }
    if (!cron.validate(config.cron)) {
      throw new CronJobError(`Invalid cron expression: ${config.cron}`, jobId, CRON_ERROR_CODE.INVALID_CRON);
    }
    if (!Array.isArray(config.targets) || config.targets.length === 0) {
      throw new CronJobError("Targets must be a non-empty array", jobId, CRON_ERROR_CODE.CONFIG_INVALID);
    }
    const validatedTargets = config.targets.map((target, index) => {
      if (!target || typeof target !== "object") {
        throw new CronJobError(`Target ${index} must be an object`, jobId, CRON_ERROR_CODE.CONFIG_INVALID);
      }
      if (!target.id || typeof target.id !== "string") {
        throw new CronJobError(
          `Target ${index} id is required and must be a string`,
          jobId,
          CRON_ERROR_CODE.CONFIG_INVALID
        );
      }
      if (target.value === void 0) {
        throw new CronJobError(`Target ${index} value is required`, jobId, CRON_ERROR_CODE.CONFIG_INVALID);
      }
      const targetType = target.type || CRON_TARGET_TYPE.VALUE;
      if (!Object.values(CRON_TARGET_TYPE).includes(targetType)) {
        throw new CronJobError(
          `Target ${index} type must be one of: ${Object.values(CRON_TARGET_TYPE).join(", ")}`,
          jobId,
          CRON_ERROR_CODE.CONFIG_INVALID
        );
      }
      if (targetType === CRON_TARGET_TYPE.STATE) {
        if (typeof target.value !== "string" || !target.value.trim()) {
          throw new CronJobError(
            `Target ${index} with type 'state' must have a non-empty string value (state ID)`,
            jobId,
            CRON_ERROR_CODE.CONFIG_INVALID
          );
        }
      } else if (targetType === CRON_TARGET_TYPE.VALUE) {
        const valueType = typeof target.value;
        if (!["string", "number", "boolean"].includes(valueType) && target.value !== null) {
          throw new CronJobError(
            `Target ${index} with type 'value' must be string, number, boolean, or null`,
            jobId,
            CRON_ERROR_CODE.CONFIG_INVALID
          );
        }
      }
      if (target.delay !== void 0) {
        if (typeof target.delay !== "number" || target.delay < 0 || target.delay > 6e4) {
          throw new CronJobError(
            `Target ${index} delay must be a number between 0 and 60000 milliseconds`,
            jobId,
            CRON_ERROR_CODE.CONFIG_INVALID
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
      throw new CronJobError("Active flag must be a boolean", jobId, CRON_ERROR_CODE.CONFIG_INVALID);
    }
    if (!config.type || !Object.values(CRON_JOB_TYPE).includes(config.type)) {
      throw new CronJobError(
        `Type must be one of: ${Object.values(CRON_JOB_TYPE).join(", ")}`,
        jobId,
        CRON_ERROR_CODE.CONFIG_INVALID
      );
    }
    return {
      cron: config.cron,
      targets: validatedTargets,
      active: config.active,
      type: config.type
    };
  }
}
class CronJobManager {
  adapter;
  jobs = /* @__PURE__ */ new Map();
  constructor(adapter) {
    this.adapter = adapter;
  }
  /**
   * Initialize the cron job manager
   */
  initialize() {
    this.adapter.log.info("CronJobManager: Initializing...");
    this.checkForJobChanges();
    this.adapter.log.info("CronJobManager: Initialized (event-driven mode)");
  }
  /**
   * Shutdown the cron job manager
   */
  shutdown() {
    this.adapter.log.info("CronJobManager: Shutting down...");
    for (const [jobId, job] of this.jobs) {
      if (job.task) {
        job.task.stop();
        this.adapter.log.debug(`CronJobManager: Stopped job ${jobId}`);
      }
    }
    this.jobs.clear();
    this.adapter.log.info("CronJobManager: Shutdown complete");
  }
  /**
   * Add or update a cron job
   */
  async addOrUpdateJob(jobId, config) {
    try {
      this.adapter.log.debug(`CronJobManager: Adding/updating job ${jobId}`);
      const validatedConfig = ConfigValidator.validateCronJobConfig(config, jobId);
      const existingJob = this.jobs.get(jobId);
      if (existingJob == null ? void 0 : existingJob.task) {
        existingJob.task.stop();
      }
      const newJob = {
        id: jobId,
        config: { ...validatedConfig },
        status: {
          status: CRON_JOB_STATUS.PENDING,
          nextRun: validatedConfig.active ? this.getNextRunTime(validatedConfig.cron) : void 0
        }
      };
      if (validatedConfig.active) {
        newJob.task = cron.schedule(validatedConfig.cron, () => {
          this.executeJob(jobId);
        });
        this.adapter.log.info(`CronJobManager: Started job ${jobId} with cron '${validatedConfig.cron}'`);
      } else {
        this.adapter.log.info(`CronJobManager: Job ${jobId} created but not active`);
      }
      this.jobs.set(jobId, newJob);
      const triggerId = jobId + ".trigger";
      await this.adapter.setObjectNotExistsAsync(triggerId, {
        type: "state",
        common: {
          name: "Manual Trigger",
          type: "boolean",
          role: "button",
          read: false,
          write: true
        },
        native: {}
      });
      await this.updateJobStatus(jobId, newJob.status);
    } catch (error) {
      this.adapter.log.error(`CronJobManager: Error adding job ${jobId}: ${error}`);
      const errorStatus = {
        status: CRON_JOB_STATUS.ERROR,
        error: error instanceof Error ? error.message : String(error)
      };
      await this.updateJobStatus(jobId, errorStatus);
      throw error;
    }
  }
  /**
   * Remove a cron job
   */
  removeJob(jobId) {
    const job = this.jobs.get(jobId);
    if (job) {
      if (job.task) {
        job.task.stop();
      }
      this.jobs.delete(jobId);
      this.adapter.log.info(`CronJobManager: Removed job ${jobId}`);
    }
  }
  /**
   * Handle job state change (called from adapter onStateChange)
   */
  async handleJobStateChange(jobId) {
    try {
      this.adapter.log.debug(`CronJobManager: Handling state change for job ${jobId}`);
      const state = await this.adapter.getStateAsync(jobId);
      const obj = await this.adapter.getObjectAsync(jobId);
      if (!state || !obj) {
        this.adapter.log.debug(`CronJobManager: State or object not found for job ${jobId}`);
        return;
      }
      let config;
      if (state.val && typeof state.val === "string") {
        try {
          config = JSON.parse(state.val);
          this.adapter.log.debug(`CronJobManager: Using config from state value for job ${jobId}`);
        } catch (error) {
          this.adapter.log.error(`CronJobManager: Error parsing job config from state ${jobId}: ${error}`);
          return;
        }
      } else if (obj.native && obj.native.cron) {
        config = obj.native;
        this.adapter.log.debug(`CronJobManager: Using config from native object for job ${jobId}`);
      } else {
        this.adapter.log.debug(`CronJobManager: No valid config found for job ${jobId}`);
        return;
      }
      const existingJob = this.jobs.get(jobId);
      if (!existingJob || JSON.stringify(existingJob.config) !== JSON.stringify(config)) {
        if (existingJob) {
          this.adapter.log.info(`CronJobManager: Configuration changed for job ${jobId}, removing old job`);
          this.removeJob(jobId);
        }
        this.adapter.log.info(`CronJobManager: Adding job ${jobId} with new configuration`);
        await this.addOrUpdateJob(jobId, config);
      }
    } catch (error) {
      this.adapter.log.error(`CronJobManager: Error handling state change for job ${jobId}: ${error}`);
    }
  }
  /**
   * Manually trigger a job
   */
  async triggerJob(jobId) {
    await this.refreshJobConfig(jobId);
    const job = this.jobs.get(jobId);
    if (!job) {
      throw new CronJobError(`Job ${jobId} not found`, jobId, CRON_ERROR_CODE.TARGET_NOT_FOUND);
    }
    this.adapter.log.info(`CronJobManager: Manually triggering job ${jobId}`);
    await this.executeJob(jobId);
  }
  /**
   * Refresh job configuration from current state
   */
  async refreshJobConfig(jobId) {
    try {
      const state = await this.adapter.getStateAsync(jobId);
      const obj = await this.adapter.getObjectAsync(jobId);
      if (!state || !obj) {
        this.adapter.log.warn(
          `CronJobManager: Could not refresh config for job ${jobId} - state or object not found`
        );
        return;
      }
      let config;
      if (state.val && typeof state.val === "string") {
        try {
          config = JSON.parse(state.val);
          this.adapter.log.debug(`CronJobManager: Refreshed config from state value for job ${jobId}`);
        } catch (error) {
          this.adapter.log.error(`CronJobManager: Error parsing job config from state ${jobId}: ${error}`);
          return;
        }
      } else if (obj.native && obj.native.cron) {
        config = obj.native;
        this.adapter.log.debug(`CronJobManager: Refreshed config from native object for job ${jobId}`);
      } else {
        this.adapter.log.debug(`CronJobManager: No valid config found for job ${jobId} during refresh`);
        return;
      }
      if (!config.cron || !config.targets) {
        this.adapter.log.error(
          `CronJobManager: Invalid refreshed config for job ${jobId}: missing cron or targets`
        );
        return;
      }
      const existingJob = this.jobs.get(jobId);
      if (existingJob && JSON.stringify(existingJob.config) !== JSON.stringify(config)) {
        this.adapter.log.info(`CronJobManager: Config changed during refresh for job ${jobId}, updating job`);
        this.removeJob(jobId);
        await this.addOrUpdateJob(jobId, config);
      }
    } catch (error) {
      this.adapter.log.error(`CronJobManager: Error refreshing job config for ${jobId}: ${error}`);
    }
  }
  /**
   * Execute a cron job
   */
  async executeJob(jobId) {
    const job = this.jobs.get(jobId);
    if (!job) {
      this.adapter.log.error(`CronJobManager: Job ${jobId} not found for execution`);
      return;
    }
    const startTime = (/* @__PURE__ */ new Date()).toISOString();
    this.adapter.log.info(`CronJobManager: Executing job ${jobId}`);
    try {
      this.adapter.log.debug(`CronJobManager: Job ${jobId} has ${job.config.targets.length} targets to execute`);
      for (const target of job.config.targets) {
        this.adapter.log.debug(`CronJobManager: Executing target ${target.id} with value ${target.value}`);
        await this.executeTarget(target);
      }
      const status = {
        lastRun: startTime,
        status: CRON_JOB_STATUS.SUCCESS,
        nextRun: job.config.active && job.config.type === CRON_JOB_TYPE.RECURRING ? this.getNextRunTime(job.config.cron) : void 0
      };
      job.status = status;
      await this.updateJobStatus(jobId, status);
      if (job.config.type === CRON_JOB_TYPE.ONCE) {
        this.adapter.log.info(`CronJobManager: One-time job ${jobId} completed, deactivating`);
        job.config.active = false;
        if (job.task) {
          job.task.stop();
        }
        await this.updateJobConfig(jobId, job.config);
      }
      this.adapter.log.info(`CronJobManager: Job ${jobId} executed successfully`);
    } catch (error) {
      this.adapter.log.error(`CronJobManager: Error executing job ${jobId}: ${error}`);
      const errorStatus = {
        lastRun: startTime,
        status: CRON_JOB_STATUS.ERROR,
        error: error instanceof Error ? error.message : String(error),
        nextRun: job.config.active && job.config.type === CRON_JOB_TYPE.RECURRING ? this.getNextRunTime(job.config.cron) : void 0
      };
      job.status = errorStatus;
      await this.updateJobStatus(jobId, errorStatus);
    }
  }
  /**
   * Execute a single target
   */
  async executeTarget(target) {
    try {
      if (target.delay && target.delay > 0) {
        this.adapter.log.debug(`CronJobManager: Delaying execution of ${target.id} by ${target.delay}ms`);
        await new Promise((resolve) => setTimeout(resolve, target.delay));
      }
      const resolvedValue = await this.resolveTargetValue(target);
      await this.adapter.setForeignStateAsync(target.id, {
        val: resolvedValue,
        ack: false
      });
      this.adapter.log.debug(
        `CronJobManager: Set ${target.id} = ${resolvedValue} (type: ${target.type || CRON_TARGET_TYPE.VALUE})${target.delay ? ` after ${target.delay}ms delay` : ""}`
      );
    } catch (error) {
      const errorMessage = `Error setting ${target.id}: ${error instanceof Error ? error.message : String(error)}`;
      this.adapter.log.error(`CronJobManager: ${errorMessage}`);
      throw new CronJobError(
        errorMessage,
        target.id,
        CRON_ERROR_CODE.EXECUTION_FAILED,
        error instanceof Error ? error : void 0
      );
    }
  }
  /**
   * Resolve target value based on type
   */
  async resolveTargetValue(target) {
    const targetType = target.type || CRON_TARGET_TYPE.VALUE;
    switch (targetType) {
      case CRON_TARGET_TYPE.VALUE:
        return target.value;
      case CRON_TARGET_TYPE.STATE:
        return await this.resolveStateReference(target.value, target.id);
      default:
        this.adapter.log.warn(
          `CronJobManager: Unknown target type '${targetType}' for target ${target.id}, using direct value`
        );
        return target.value;
    }
  }
  /**
   * Resolve state reference to actual state value
   */
  async resolveStateReference(stateId, targetId) {
    try {
      if (!stateId || typeof stateId !== "string") {
        throw new CronJobError(`Invalid state reference: ${stateId}`, targetId, CRON_ERROR_CODE.CONFIG_INVALID);
      }
      this.adapter.log.debug(`CronJobManager: Resolving state reference '${stateId}' for target ${targetId}`);
      const state = await this.adapter.getStateAsync(stateId);
      if (!state) {
        throw new CronJobError(`State '${stateId}' not found`, targetId, CRON_ERROR_CODE.TARGET_NOT_FOUND);
      }
      this.adapter.log.debug(`CronJobManager: Resolved state '${stateId}' = ${state.val} for target ${targetId}`);
      return state.val;
    } catch (error) {
      if (error instanceof CronJobError) {
        throw error;
      }
      throw new CronJobError(
        `Error resolving state reference '${stateId}': ${error instanceof Error ? error.message : String(error)}`,
        targetId,
        CRON_ERROR_CODE.EXECUTION_FAILED,
        error instanceof Error ? error : void 0
      );
    }
  }
  /**
   * Resolve JavaScript expression with secure sandbox
   */
  /**
   * Update job status in ioBroker state
   */
  async updateJobStatus(jobId, status) {
    try {
      const statusId = jobId + ".status";
      await this.adapter.setObjectNotExistsAsync(statusId, {
        type: "state",
        common: {
          name: "Job Status",
          type: "string",
          role: "json",
          read: true,
          write: false
        },
        native: {}
      });
      this.adapter.setState(statusId, {
        val: JSON.stringify(status),
        ack: true
      });
    } catch (error) {
      this.adapter.log.error(`CronJobManager: Error updating status for ${jobId}: ${error}`);
    }
  }
  /**
   * Update job config in ioBroker state
   */
  async updateJobConfig(jobId, config) {
    try {
      const state = await this.adapter.getStateAsync(jobId);
      if (state) {
        const obj = await this.adapter.getObjectAsync(jobId);
        if (obj) {
          obj.native = config;
          await this.adapter.setObjectAsync(jobId, obj);
        }
      }
    } catch (error) {
      this.adapter.log.error(`CronJobManager: Error updating config for ${jobId}: ${error}`);
    }
  }
  /**
   * Get next run time for a cron expression
   */
  getNextRunTime(cronExpression) {
    try {
      const now = /* @__PURE__ */ new Date();
      const nextRun = new Date(now.getTime() + 6e4);
      return nextRun.toISOString();
    } catch (error) {
      this.adapter.log.error(`CronJobManager: Error calculating next run time: ${error}`);
      return void 0;
    }
  }
  /**
   * Initial scan for existing jobs (called once during initialization)
   */
  async checkForJobChanges() {
    try {
      const cronFolder = this.adapter.config.cronFolder || `${this.adapter.namespace}.jobs`;
      const states = await this.adapter.getStatesAsync(`${cronFolder}.*`);
      if (!states) {
        this.adapter.log.debug("CronJobManager: No existing jobs found during initialization");
        return;
      }
      this.adapter.log.debug(`CronJobManager: Found ${Object.keys(states).length} states during initialization`);
      for (const [stateId, state] of Object.entries(states)) {
        if (stateId.endsWith(".trigger") || stateId.endsWith(".status") || !state) continue;
        await this.handleJobStateChange(stateId);
      }
      this.adapter.log.info(`CronJobManager: Initialized ${this.jobs.size} jobs`);
    } catch (error) {
      this.adapter.log.error(`CronJobManager: Error during initial job scan: ${error}`);
    }
  }
  /**
   * Get status of all jobs
   */
  getJobsStatus() {
    return Array.from(this.jobs.values()).map((job) => ({
      id: job.id,
      config: job.config,
      status: job.status
    }));
  }
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  CRON_ERROR_CODE,
  CRON_JOB_STATUS,
  CRON_JOB_TYPE,
  CRON_TARGET_TYPE,
  ConfigValidator,
  CronJobError,
  CronJobManager
});
//# sourceMappingURL=CronJobManager.js.map
