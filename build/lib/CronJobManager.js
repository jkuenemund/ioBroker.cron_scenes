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
  CRON_ERROR_CODE: () => import_errors.CRON_ERROR_CODE,
  CRON_JOB_STATUS: () => import_constants.CRON_JOB_STATUS,
  CRON_JOB_TYPE: () => import_constants.CRON_JOB_TYPE,
  CRON_TARGET_TYPE: () => import_constants.CRON_TARGET_TYPE,
  CronJobError: () => import_errors.CronJobError,
  CronJobManager: () => CronJobManager
});
module.exports = __toCommonJS(CronJobManager_exports);
var cron = __toESM(require("node-cron"));
var import_ConfigValidator = require("./ConfigValidator");
var import_constants = require("./constants");
var import_errors = require("./errors");
class CronJobManager {
  constructor(adapter) {
    this.adapter = adapter;
  }
  jobs = /* @__PURE__ */ new Map();
  cleanupInterval = null;
  /**
   * Initialize the cron job manager
   */
  initialize() {
    this.adapter.log.info("CronJobManager: Initializing...");
    this.adapter.log.info("CronJobManager: Initialized (event-driven mode)");
    this.startPeriodicCleanup();
  }
  /**
   * Shutdown the cron job manager
   */
  async shutdown() {
    this.adapter.log.info("CronJobManager: Shutting down...");
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
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
      const validatedConfig = import_ConfigValidator.ConfigValidator.validateCronJobConfig(config, jobId);
      const existingJob = this.jobs.get(jobId);
      if (existingJob == null ? void 0 : existingJob.task) {
        existingJob.task.stop();
      }
      const newJob = {
        id: jobId,
        config: { ...validatedConfig },
        status: {
          status: import_constants.CRON_JOB_STATUS.PENDING,
          nextRun: validatedConfig.active && validatedConfig.type !== import_constants.CRON_JOB_TYPE.MANUAL && validatedConfig.cron ? this.getNextRunTime(validatedConfig.cron) : void 0
        }
      };
      if (validatedConfig.active && validatedConfig.type !== import_constants.CRON_JOB_TYPE.MANUAL && validatedConfig.cron) {
        newJob.task = cron.schedule(validatedConfig.cron, () => {
          this.executeJob(jobId);
        });
        this.adapter.log.info(`CronJobManager: Started job ${jobId} with cron '${validatedConfig.cron}'`);
      } else if (validatedConfig.type === import_constants.CRON_JOB_TYPE.MANUAL) {
        this.adapter.log.info(`CronJobManager: Manual job ${jobId} created - trigger only execution`);
      } else {
        this.adapter.log.info(`CronJobManager: Job ${jobId} created but not active`);
      }
      this.jobs.set(jobId, newJob);
      const triggerId = jobId + ".trigger";
      await this.adapter.setObjectNotExistsAsync(triggerId, {
        type: "state",
        common: {
          name: `Manual trigger for ${jobId}`,
          type: "boolean",
          role: "button",
          read: false,
          write: true,
          desc: "Set to true to manually trigger this job"
        },
        native: {}
      });
      const statusId = jobId + ".status";
      await this.adapter.setObjectNotExistsAsync(statusId, {
        type: "state",
        common: {
          name: `Status for ${jobId}`,
          type: "string",
          role: "json",
          read: true,
          write: false,
          desc: "Current status of this job"
        },
        native: {}
      });
      await this.updateJobStatus(jobId, newJob.status);
    } catch (error) {
      this.adapter.log.error(`CronJobManager: Error adding/updating job ${jobId}: ${error}`);
      throw error;
    }
  }
  /**
   * Remove a cron job and clean up associated objects
   */
  async removeJob(jobId) {
    const job = this.jobs.get(jobId);
    if (job) {
      if (job.task) {
        job.task.stop();
      }
      this.jobs.delete(jobId);
      this.adapter.log.info(`CronJobManager: Removed job ${jobId}`);
    }
    await this.cleanupJobObjects(jobId);
  }
  /**
   * Clean up status and trigger objects for a job
   */
  async cleanupJobObjects(jobId) {
    try {
      const statusId = jobId + ".status";
      await this.adapter.delObjectAsync(statusId);
      this.adapter.log.debug(`CronJobManager: Cleaned up status object ${statusId}`);
      const triggerId = jobId + ".trigger";
      await this.adapter.delObjectAsync(triggerId);
      this.adapter.log.debug(`CronJobManager: Cleaned up trigger object ${triggerId}`);
    } catch (error) {
      this.adapter.log.warn(`CronJobManager: Error cleaning up objects for job ${jobId}: ${error}`);
    }
  }
  /**
   * Get all registered jobs
   */
  getJobs() {
    return new Map(this.jobs);
  }
  /**
   * Handle state changes for job configurations
   */
  async handleJobStateChange(jobId, state) {
    try {
      if (!state || !state.val) {
        this.adapter.log.debug(`CronJobManager: Ignoring empty state change for ${jobId}`);
        return;
      }
      let config;
      try {
        config = JSON.parse(state.val);
      } catch (parseError) {
        this.adapter.log.error(`CronJobManager: Invalid JSON configuration for job ${jobId}: ${parseError}`);
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
    try {
      this.adapter.log.info(`CronJobManager: Manual trigger requested for job ${jobId}`);
      await this.refreshJobConfig(jobId);
      const job = this.jobs.get(jobId);
      if (!job) {
        throw new import_errors.CronJobError(`Job ${jobId} not found`, jobId, import_errors.CRON_ERROR_CODE.TARGET_NOT_FOUND);
      }
      if (!job.config.active) {
        this.adapter.log.warn(`CronJobManager: Job ${jobId} is not active, skipping manual trigger`);
        return;
      }
      await this.executeJob(jobId);
    } catch (error) {
      this.adapter.log.error(`CronJobManager: Error triggering job ${jobId}: ${error}`);
      throw error;
    }
  }
  /**
   * Refresh job configuration from state
   */
  async refreshJobConfig(jobId) {
    try {
      const stateObj = await this.adapter.getStateAsync(jobId);
      if (!stateObj || !stateObj.val) {
        this.adapter.log.warn(
          `CronJobManager: No configuration found for job ${jobId} during refresh, keeping existing config`
        );
        return;
      }
      let config;
      try {
        config = JSON.parse(stateObj.val);
      } catch (parseError) {
        this.adapter.log.error(
          `CronJobManager: Invalid JSON configuration for job ${jobId} during refresh: ${parseError}`
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
    const startTime = (/* @__PURE__ */ new Date()).toISOString();
    try {
      const job = this.jobs.get(jobId);
      if (!job) {
        throw new import_errors.CronJobError(`Job ${jobId} not found`, jobId, import_errors.CRON_ERROR_CODE.TARGET_NOT_FOUND);
      }
      this.adapter.log.info(`CronJobManager: Executing job ${jobId}`);
      for (const target of job.config.targets) {
        this.adapter.log.debug(`CronJobManager: Executing target ${target.id} with value ${target.value}`);
        await this.executeTarget(target);
      }
      const status = {
        lastRun: startTime,
        status: import_constants.CRON_JOB_STATUS.SUCCESS,
        nextRun: job.config.active && job.config.type === import_constants.CRON_JOB_TYPE.RECURRING && job.config.cron ? this.getNextRunTime(job.config.cron) : void 0
      };
      job.status = status;
      await this.updateJobStatus(jobId, status);
      if (job.config.type === import_constants.CRON_JOB_TYPE.ONCE) {
        this.adapter.log.info(`CronJobManager: One-time job ${jobId} completed, deactivating`);
        job.config.active = false;
        if (job.task) {
          job.task.stop();
          job.task = void 0;
        }
      }
      this.adapter.log.info(`CronJobManager: Job ${jobId} executed successfully`);
    } catch (error) {
      this.adapter.log.error(`CronJobManager: Error executing job ${jobId}: ${error}`);
      const job = this.jobs.get(jobId);
      const errorStatus = {
        lastRun: startTime,
        status: import_constants.CRON_JOB_STATUS.ERROR,
        error: error instanceof Error ? error.message : String(error),
        nextRun: (job == null ? void 0 : job.config.active) && job.config.type === import_constants.CRON_JOB_TYPE.RECURRING && job.config.cron ? this.getNextRunTime(job.config.cron) : void 0
      };
      if (job) {
        job.status = errorStatus;
      }
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
        `CronJobManager: Set ${target.id} = ${resolvedValue} (type: ${target.type || import_constants.CRON_TARGET_TYPE.VALUE})${target.delay ? ` after ${target.delay}ms delay` : ""}`
      );
    } catch (error) {
      const errorMessage = `Error setting ${target.id}: ${error instanceof Error ? error.message : String(error)}`;
      this.adapter.log.error(`CronJobManager: ${errorMessage}`);
      throw new import_errors.CronJobError(
        errorMessage,
        target.id,
        import_errors.CRON_ERROR_CODE.EXECUTION_FAILED,
        error instanceof Error ? error : void 0
      );
    }
  }
  /**
   * Resolve target value based on type
   */
  async resolveTargetValue(target) {
    const targetType = target.type || import_constants.CRON_TARGET_TYPE.VALUE;
    switch (targetType) {
      case import_constants.CRON_TARGET_TYPE.VALUE:
        return target.value;
      case import_constants.CRON_TARGET_TYPE.STATE:
        try {
          const sourceState = await this.adapter.getStateAsync(target.value);
          if (sourceState === null || sourceState === void 0) {
            this.adapter.log.warn(`CronJobManager: Source state ${target.value} not found, using null`);
            return null;
          }
          return sourceState.val;
        } catch (error) {
          this.adapter.log.error(`CronJobManager: Error reading source state ${target.value}: ${error}`);
          throw error;
        }
      default:
        throw new import_errors.CronJobError(`Unknown target type: ${targetType}`, target.id, import_errors.CRON_ERROR_CODE.CONFIG_INVALID);
    }
  }
  /**
   * Update job status
   */
  async updateJobStatus(jobId, status) {
    try {
      const statusId = jobId + ".status";
      await this.adapter.setForeignStateAsync(statusId, {
        val: JSON.stringify(status, null, 2),
        ack: true
      });
    } catch (error) {
      this.adapter.log.error(`CronJobManager: Error updating status for job ${jobId}: ${error}`);
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
      this.adapter.log.warn(`CronJobManager: Error calculating next run time for '${cronExpression}': ${error}`);
      return void 0;
    }
  }
  /**
   * Start periodic cleanup of orphaned objects
   */
  startPeriodicCleanup() {
    this.cleanupInterval = setInterval(
      async () => {
        await this.cleanupOrphanedObjects();
      },
      5 * 60 * 1e3
      // 5 minutes
    );
    this.adapter.log.debug("CronJobManager: Started periodic cleanup of orphaned objects");
  }
  /**
   * Clean up orphaned status and trigger objects
   */
  async cleanupOrphanedObjects() {
    try {
      this.adapter.log.debug("CronJobManager: Starting cleanup of orphaned objects");
      const objects = await this.adapter.getObjectListAsync({
        startkey: this.adapter.namespace,
        endkey: this.adapter.namespace + "\u9999"
      });
      const orphanedObjects = [];
      for (const obj of objects.rows) {
        const objId = obj.id;
        if (objId.endsWith(".status") || objId.endsWith(".trigger")) {
          const jobId = objId.replace(/\.(status|trigger)$/, "");
          if (!this.jobs.has(jobId)) {
            const jobStateExists = await this.checkJobStateExists(jobId);
            if (!jobStateExists) {
              orphanedObjects.push(objId);
            }
          }
        }
      }
      for (const objId of orphanedObjects) {
        try {
          await this.adapter.delObjectAsync(objId);
          this.adapter.log.info(`CronJobManager: Cleaned up orphaned object ${objId}`);
        } catch (error) {
          this.adapter.log.warn(`CronJobManager: Error removing orphaned object ${objId}: ${error}`);
        }
      }
      if (orphanedObjects.length > 0) {
        this.adapter.log.info(`CronJobManager: Cleaned up ${orphanedObjects.length} orphaned objects`);
      }
    } catch (error) {
      this.adapter.log.error(`CronJobManager: Error during orphaned objects cleanup: ${error}`);
    }
  }
  /**
   * Check if a job state object exists
   */
  async checkJobStateExists(jobId) {
    try {
      const state = await this.adapter.getStateAsync(jobId);
      return state !== null && state !== void 0;
    } catch (error) {
      return false;
    }
  }
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  CRON_ERROR_CODE,
  CRON_JOB_STATUS,
  CRON_JOB_TYPE,
  CRON_TARGET_TYPE,
  CronJobError,
  CronJobManager
});
//# sourceMappingURL=CronJobManager.js.map
