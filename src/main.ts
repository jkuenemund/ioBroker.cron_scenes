/*
 * Created with @iobroker/create-adapter v2.6.5
 */

// The adapter-core module gives you access to the core ioBroker functions
// you need to create an adapter
import * as utils from "@iobroker/adapter-core";

// Load our modules
import { CronJobConfig, CronJobManager } from "./lib/CronJobManager";

class CronScenes extends utils.Adapter {
	private cronJobManager: CronJobManager;

	public constructor(options: Partial<utils.AdapterOptions> = {}) {
		super({
			...options,
			name: "cron_scenes",
		});
		this.on("ready", this.onReady.bind(this));
		this.on("stateChange", this.onStateChange.bind(this));
		this.on("objectChange", this.onObjectChange.bind(this));
		// this.on("message", this.onMessage.bind(this));
		this.on("unload", this.onUnload.bind(this));

		// Initialize CronJobManager
		this.cronJobManager = new CronJobManager(this);
	}

	/**
	 * Is called when databases are connected and adapter received configuration.
	 */
	private async onReady(): Promise<void> {
		// Initialize your adapter here

		// The adapters config (in the instance object everything under the attribute "native") is accessible via
		// this.config:
		this.log.info("config cronFolder: " + this.config.cronFolder);
		this.log.info("config checkInterval: " + this.config.checkInterval);
		this.log.info("config enableLogging: " + this.config.enableLogging);

		/*
		For every state in the system there has to be also an object of type state
		Here a simple template for a boolean variable named "testVariable"
		Because every adapter instance uses its own unique namespace variable names can't collide with other adapters variables
		*/
		await this.setObjectNotExistsAsync("testVariable", {
			type: "state",
			common: {
				name: "testVariable",
				type: "boolean",
				role: "indicator",
				read: true,
				write: true,
			},
			native: {},
		});

		// In order to get state updates, you need to subscribe to them. The following line adds a subscription for our variable we have created above.
		this.subscribeStates("testVariable");
		// You can also add a subscription for multiple states. The following line watches all states starting with "lights."
		// this.subscribeStates("lights.*");
		// Or, if you really must, you can also watch all states. Don't do this if you don't need to. Otherwise this will cause a lot of unnecessary load on the system:
		// this.subscribeStates("*");

		/*
			setState examples
			you will notice that each setState will cause the stateChange event to fire (because of above subscribeStates cmd)
		*/
		// the variable testVariable is set to true as command (ack=false)
		await this.setStateAsync("testVariable", true);

		// same thing, but the value is flagged "ack"
		// ack should be always set to true if the value is received from or acknowledged from the target system
		await this.setStateAsync("testVariable", { val: true, ack: true });

		// same thing, but the state is deleted after 30s (getState will return null afterwards)
		await this.setStateAsync("testVariable", { val: true, ack: true, expire: 30 });

		// Initialize cron scenes adapter
		this.log.info("Cron Scenes adapter started successfully");

		// Start CronJobManager
		this.cronJobManager.initialize();

		// Subscribe to job states in the configured folder
		const cronFolder = this.config.cronFolder || `${this.namespace}.jobs`;
		this.subscribeStates(`${cronFolder}.*`);
	}

	/**
	 * Is called when adapter shuts down - callback has to be called under any circumstances!
	 */
	private onUnload(callback: () => void): void {
		try {
			// Shutdown CronJobManager
			this.cronJobManager.shutdown();

			callback();
		} catch (e) {
			callback();
		}
	}

	/**
	 * Is called if a subscribed object changes
	 */
	private onObjectChange(id: string, obj: ioBroker.Object | null | undefined): void {
		if (obj) {
			// The object was changed
			this.log.debug(`object ${id} changed`);

			// Check if this is a job configuration change
			const cronFolder = this.config.cronFolder || `${this.namespace}.jobs`;
			if (id.startsWith(cronFolder)) {
				// Job object updated - let checkForJobChanges handle it
				this.log.debug(`Job object ${id} updated`);
			}
		} else {
			// The object was deleted
			this.log.debug(`object ${id} deleted`);

			// Check if this is a job deletion
			const cronFolder = this.config.cronFolder || `${this.namespace}.jobs`;
			if (id.startsWith(cronFolder)) {
				// Job deleted
				this.cronJobManager.removeJob(id);
			}
		}
	}

	/**
	 * Is called if a subscribed state changes
	 */
	private onStateChange(id: string, state: ioBroker.State | null | undefined): void {
		if (state) {
			// The state was changed
			this.log.debug(`state ${id} changed: ${state.val} (ack = ${state.ack})`);

			// Check if this is a trigger state
			if (id.endsWith(".trigger") && state.val === true && !state.ack) {
				const jobId = id.replace(".trigger", "");
				this.log.info(`Manual trigger for job ${jobId}`);

				// Trigger the job
				this.cronJobManager.triggerJob(jobId).catch((error) => {
					this.log.error(`Error triggering job ${jobId}: ${error}`);
				});

				// Reset trigger state
				this.setStateAsync(id, false, true);
			}

			// Skip processing status states as job changes
			if (id.endsWith(".status")) {
				return;
			}
		} else {
			// The state was deleted
			this.log.debug(`state ${id} deleted`);
		}
	}

	/**
	 * Handle job configuration changes
	 */
	private async handleJobConfigChange(id: string, config: CronJobConfig): Promise<void> {
		try {
			await this.cronJobManager.addOrUpdateJob(id, config);
		} catch (error) {
			this.log.error(`Error updating job ${id}: ${error}`);
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
	// Export the constructor in compact mode
	module.exports = (options: Partial<utils.AdapterOptions> | undefined) => new CronScenes(options);
} else {
	// otherwise start the instance directly
	(() => new CronScenes())();
}
