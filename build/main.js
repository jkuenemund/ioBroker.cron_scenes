"use strict";
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
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
var utils = __toESM(require("@iobroker/adapter-core"));
var import_CronJobManager = require("./lib/CronJobManager");
class CronScenes extends utils.Adapter {
  cronJobManager;
  constructor(options = {}) {
    super({
      ...options,
      name: "cron_scenes"
    });
    this.on("ready", this.onReady.bind(this));
    this.on("stateChange", this.onStateChange.bind(this));
    this.on("objectChange", this.onObjectChange.bind(this));
    this.on("unload", this.onUnload.bind(this));
    this.cronJobManager = new import_CronJobManager.CronJobManager(this);
  }
  /**
   * Is called when databases are connected and adapter received configuration.
   */
  async onReady() {
    this.log.info("config cronFolder: " + this.config.cronFolder);
    this.log.info("config enableLogging: " + this.config.enableLogging);
    this.log.info("config defaultJobsActive: " + this.config.defaultJobsActive);
    this.log.info("config maxConcurrentJobs: " + this.config.maxConcurrentJobs);
    this.log.info("config jobTimeout: " + this.config.jobTimeout);
    await this.setObjectNotExistsAsync("testVariable", {
      type: "state",
      common: {
        name: "testVariable",
        type: "boolean",
        role: "indicator",
        read: true,
        write: true
      },
      native: {}
    });
    await this.setObjectNotExistsAsync("testVariable2", {
      type: "state",
      common: {
        name: "testVariable2",
        type: "boolean",
        role: "indicator",
        read: true,
        write: true
      },
      native: {}
    });
    await this.setObjectNotExistsAsync("testVariable3", {
      type: "state",
      common: {
        name: "testVariable3",
        type: "number",
        role: "value",
        read: true,
        write: true
      },
      native: {}
    });
    this.subscribeStates("testVariable");
    this.setState("testVariable", { val: true, ack: false });
    this.setState("testVariable", { val: true, ack: true });
    this.setState("testVariable", { val: true, ack: true, expire: 30 });
    this.log.info("Cron Scenes adapter started successfully");
    const cronFolder = this.config.cronFolder || `${this.namespace}.jobs`;
    await this.createJobsFolder(cronFolder);
    this.cronJobManager.initialize();
    this.subscribeStates(`${cronFolder}.*`);
  }
  /**
   * Create jobs folder structure
   */
  async createJobsFolder(cronFolder) {
    try {
      await this.setObjectNotExistsAsync(cronFolder, {
        type: "folder",
        common: {
          name: "Cron Jobs",
          desc: "Folder containing all cron job configurations"
        },
        native: {}
      });
      const exampleJobId = `${cronFolder}.example`;
      await this.setObjectNotExistsAsync(exampleJobId, {
        type: "state",
        common: {
          name: "Example Cron Job",
          type: "string",
          role: "json",
          read: true,
          write: true,
          desc: "Example cron job configuration - you can copy and modify this"
        },
        native: {
          cron: "* * * * *",
          targets: [
            {
              id: "cron_scenes.0.testVariable",
              value: true
            }
          ],
          active: this.config.defaultJobsActive || false,
          type: import_CronJobManager.CRON_JOB_TYPE.RECURRING
        }
      });
      const exampleConfig = {
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
        active: this.config.defaultJobsActive || false,
        type: import_CronJobManager.CRON_JOB_TYPE.RECURRING
      };
      this.setState(exampleJobId, {
        val: JSON.stringify(exampleConfig, null, 2),
        ack: true
      });
      this.log.info(`Jobs folder created at: ${cronFolder}`);
      this.log.info(`Example job created at: ${exampleJobId}`);
    } catch (error) {
      this.log.error(`Error creating jobs folder: ${error}`);
    }
  }
  /**
   * Is called when adapter shuts down - callback has to be called under any circumstances!
   */
  onUnload(callback) {
    try {
      this.cronJobManager.shutdown();
      callback();
    } catch (e) {
      callback();
    }
  }
  /**
   * Is called if a subscribed object changes
   */
  onObjectChange(id, obj) {
    if (obj) {
      this.log.debug(`object ${id} changed`);
      const cronFolder = this.config.cronFolder || `${this.namespace}.jobs`;
      if (id.startsWith(cronFolder)) {
        this.log.debug(`Job object ${id} updated`);
      }
    } else {
      this.log.debug(`object ${id} deleted`);
      const cronFolder = this.config.cronFolder || `${this.namespace}.jobs`;
      if (id.startsWith(cronFolder)) {
        this.cronJobManager.removeJob(id);
      }
    }
  }
  /**
   * Is called if a subscribed state changes
   */
  onStateChange(id, state) {
    if (state) {
      this.log.debug(`state ${id} changed: ${state.val} (ack = ${state.ack})`);
      if (id.endsWith(".trigger") && state.val === true && !state.ack) {
        const jobId = id.replace(".trigger", "");
        this.log.info(`Manual trigger for job ${jobId}`);
        this.cronJobManager.triggerJob(jobId).catch((error) => {
          this.log.error(`Error triggering job ${jobId}: ${error}`);
        });
        this.setState(id, { val: false, ack: true });
        return;
      }
      if (id.endsWith(".status") || id.endsWith(".trigger")) {
        return;
      }
      const cronFolder = this.config.cronFolder || `${this.namespace}.jobs`;
      if (id.startsWith(cronFolder) && !id.endsWith(".status") && !id.endsWith(".trigger")) {
        this.cronJobManager.handleJobStateChange(id).catch((error) => {
          this.log.error(`Error handling job state change for ${id}: ${error}`);
        });
      }
    } else {
      this.log.debug(`state ${id} deleted`);
      const cronFolder = this.config.cronFolder || `${this.namespace}.jobs`;
      if (id.startsWith(cronFolder)) {
        this.cronJobManager.removeJob(id);
      }
    }
  }
  // If you need to accept messages in your adapter, uncomment the following block and the corresponding line in the constructor.
  // /**
  //  * Some message was sent to this instance over message box. Used by email, pushover, text2speech, ...
  //  * Using this method requires "common.messagebox" property to be set to true in io-package.json
  //  */
  // private onMessage(obj: ioBroker.Message): void {
  // 	if (typeof obj === "object" && obj.message) {
  // 		if (obj.command === "send") {
  // 			// e.g. send email or pushover or whatever
  // 			this.log.info("send command");
  // 			// Send response in callback if required
  // 			if (obj.callback) this.sendTo(obj.from, obj.command, "Message received", obj.callback);
  // 		}
  // 	}
  // }
}
if (require.main !== module) {
  module.exports = (options) => new CronScenes(options);
} else {
  (() => new CronScenes())();
}
//# sourceMappingURL=main.js.map
