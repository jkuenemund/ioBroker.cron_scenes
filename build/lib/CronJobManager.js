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
  CronJobManager: () => CronJobManager
});
module.exports = __toCommonJS(CronJobManager_exports);
var cron = __toESM(require("node-cron"));
class CronJobManager {
  adapter;
  // Use any to avoid TypeScript export issues
  jobs = /* @__PURE__ */ new Map();
  checkInterval;
  constructor(adapter) {
    this.adapter = adapter;
  }
  /**
   * Initialize the cron job manager
   */
  initialize() {
    this.adapter.log.info("CronJobManager: Initializing...");
    const interval = this.adapter.config.checkInterval || 30;
    this.checkInterval = setInterval(() => {
      this.checkForJobChanges();
    }, interval * 1e3);
    this.adapter.log.info(`CronJobManager: Initialized with ${interval}s check interval`);
  }
  /**
   * Shutdown the cron job manager
   */
  shutdown() {
    this.adapter.log.info("CronJobManager: Shutting down...");
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = void 0;
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
      if (!cron.validate(config.cron)) {
        throw new Error(`Invalid cron expression: ${config.cron}`);
      }
      const existingJob = this.jobs.get(jobId);
      if (existingJob == null ? void 0 : existingJob.task) {
        existingJob.task.stop();
      }
      const newJob = {
        id: jobId,
        config: { ...config },
        status: {
          status: "pending",
          nextRun: config.active ? this.getNextRunTime(config.cron) : void 0
        }
      };
      if (config.active) {
        newJob.task = cron.schedule(config.cron, () => {
          this.executeJob(jobId);
        });
        this.adapter.log.info(`CronJobManager: Started job ${jobId} with cron '${config.cron}'`);
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
        status: "error",
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
   * Manually trigger a job
   */
  async triggerJob(jobId) {
    const job = this.jobs.get(jobId);
    if (!job) {
      throw new Error(`Job ${jobId} not found`);
    }
    this.adapter.log.info(`CronJobManager: Manually triggering job ${jobId}`);
    await this.executeJob(jobId);
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
      for (const target of job.config.targets) {
        await this.executeTarget(target);
      }
      const status = {
        lastRun: startTime,
        status: "success",
        nextRun: job.config.active && job.config.type === "recurring" ? this.getNextRunTime(job.config.cron) : void 0
      };
      job.status = status;
      await this.updateJobStatus(jobId, status);
      if (job.config.type === "once") {
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
        status: "error",
        error: error instanceof Error ? error.message : String(error),
        nextRun: job.config.active && job.config.type === "recurring" ? this.getNextRunTime(job.config.cron) : void 0
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
      await this.adapter.setForeignStateAsync(target.id, {
        val: target.value,
        ack: false
      });
      this.adapter.log.debug(`CronJobManager: Set ${target.id} = ${target.value}`);
    } catch (error) {
      this.adapter.log.error(`CronJobManager: Error setting ${target.id}: ${error}`);
      throw error;
    }
  }
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
      await this.adapter.setStateAsync(statusId, {
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
   * Check for job state changes
   */
  async checkForJobChanges() {
    try {
      const cronFolder = this.adapter.config.cronFolder || `${this.adapter.namespace}.jobs`;
      const states = await this.adapter.getStatesAsync(`${cronFolder}.*`);
      if (!states) return;
      for (const [stateId, state] of Object.entries(states)) {
        if (stateId.endsWith(".trigger") || stateId.endsWith(".status") || !state) continue;
        const jobId = stateId;
        const obj = await this.adapter.getObjectAsync(jobId);
        if (!obj) continue;
        let config;
        if (obj.native && obj.native.cron) {
          config = obj.native;
        } else if (state.val && typeof state.val === "string") {
          try {
            config = JSON.parse(state.val);
          } catch (error) {
            this.adapter.log.error(
              `CronJobManager: Error parsing job config from state ${jobId}: ${error}`
            );
            continue;
          }
        } else {
          this.adapter.log.debug(`CronJobManager: No valid config found for job ${jobId}`);
          continue;
        }
        if (!config.cron || !config.targets) {
          this.adapter.log.error(`CronJobManager: Invalid config for job ${jobId}: missing cron or targets`);
          continue;
        }
        const existingJob = this.jobs.get(jobId);
        if (!existingJob || JSON.stringify(existingJob.config) !== JSON.stringify(config)) {
          await this.addOrUpdateJob(jobId, config);
        }
      }
      for (const jobId of this.jobs.keys()) {
        if (!states[jobId]) {
          this.removeJob(jobId);
        }
      }
    } catch (error) {
      this.adapter.log.error(`CronJobManager: Error checking for job changes: ${error}`);
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
  CronJobManager
});
//# sourceMappingURL=CronJobManager.js.map
