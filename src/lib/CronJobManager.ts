import * as cron from "node-cron";

/**
 * Interface for a cron job configuration
 */
export interface CronJobConfig {
	cron: string;
	targets: Array<{
		id: string;
		value: any;
	}>;
	active: boolean;
	type: "once" | "recurring";
	error?: string | null;
}

/**
 * Interface for a cron job status
 */
export interface CronJobStatus {
	lastRun?: string;
	status: "success" | "error" | "pending";
	nextRun?: string;
	error?: string | null;
}

/**
 * Interface for a registered cron job
 */
interface RegisteredCronJob {
	id: string;
	config: CronJobConfig;
	task?: cron.ScheduledTask;
	status: CronJobStatus;
}

/**
 * CronJobManager handles all cron job operations
 */
export class CronJobManager {
	private adapter: any; // Use any to avoid TypeScript export issues
	private jobs: Map<string, RegisteredCronJob> = new Map();
	private checkInterval?: NodeJS.Timeout;

	constructor(adapter: any) {
		this.adapter = adapter;
	}

	/**
	 * Initialize the cron job manager
	 */
	public initialize(): void {
		this.adapter.log.info("CronJobManager: Initializing...");

		// Start periodic check for job state changes
		const interval = this.adapter.config.checkInterval || 30;
		this.checkInterval = setInterval(() => {
			this.checkForJobChanges();
		}, interval * 1000);

		this.adapter.log.info(`CronJobManager: Initialized with ${interval}s check interval`);
	}

	/**
	 * Shutdown the cron job manager
	 */
	public shutdown(): void {
		this.adapter.log.info("CronJobManager: Shutting down...");

		// Clear check interval
		if (this.checkInterval) {
			clearInterval(this.checkInterval);
			this.checkInterval = undefined;
		}

		// Stop all running jobs
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
	public async addOrUpdateJob(jobId: string, config: CronJobConfig): Promise<void> {
		try {
			this.adapter.log.debug(`CronJobManager: Adding/updating job ${jobId}`);

			// Validate cron expression
			if (!cron.validate(config.cron)) {
				throw new Error(`Invalid cron expression: ${config.cron}`);
			}

			// Stop existing job if it exists
			const existingJob = this.jobs.get(jobId);
			if (existingJob?.task) {
				existingJob.task.stop();
			}

			// Create new job
			const newJob: RegisteredCronJob = {
				id: jobId,
				config: { ...config },
				status: {
					status: "pending",
					nextRun: config.active ? this.getNextRunTime(config.cron) : undefined,
				},
			};

			// Create and start cron task if active
			if (config.active) {
				newJob.task = cron.schedule(config.cron, () => {
					this.executeJob(jobId);
				});

				this.adapter.log.info(`CronJobManager: Started job ${jobId} with cron '${config.cron}'`);
			} else {
				this.adapter.log.info(`CronJobManager: Job ${jobId} created but not active`);
			}

			// Register job
			this.jobs.set(jobId, newJob);

			// Create trigger object if it doesn't exist
			const triggerId = jobId + ".trigger";
			await this.adapter.setObjectNotExistsAsync(triggerId, {
				type: "state",
				common: {
					name: "Manual Trigger",
					type: "boolean",
					role: "button",
					read: false,
					write: true,
				},
				native: {},
			});

			// Update job status in state
			await this.updateJobStatus(jobId, newJob.status);
		} catch (error) {
			this.adapter.log.error(`CronJobManager: Error adding job ${jobId}: ${error}`);

			// Update error status
			const errorStatus: CronJobStatus = {
				status: "error",
				error: error instanceof Error ? error.message : String(error),
			};

			await this.updateJobStatus(jobId, errorStatus);
			throw error;
		}
	}

	/**
	 * Remove a cron job
	 */
	public removeJob(jobId: string): void {
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
	public async triggerJob(jobId: string): Promise<void> {
		// Before triggering, ensure we have the latest configuration
		await this.refreshJobConfig(jobId);

		const job = this.jobs.get(jobId);
		if (!job) {
			throw new Error(`Job ${jobId} not found`);
		}

		this.adapter.log.info(`CronJobManager: Manually triggering job ${jobId}`);
		await this.executeJob(jobId);
	}

	/**
	 * Refresh job configuration from current state
	 */
	private async refreshJobConfig(jobId: string): Promise<void> {
		try {
			// Get current state value
			const state = await this.adapter.getStateAsync(jobId);
			const obj = await this.adapter.getObjectAsync(jobId);

			if (!state || !obj) {
				this.adapter.log.warn(
					`CronJobManager: Could not refresh config for job ${jobId} - state or object not found`,
				);
				return;
			}

			let config: CronJobConfig;

			// Try to get config from state value first, then from native as fallback
			if ((state as any).val && typeof (state as any).val === "string") {
				try {
					config = JSON.parse((state as any).val) as CronJobConfig;
					this.adapter.log.debug(`CronJobManager: Refreshed config from state value for job ${jobId}`);
				} catch (error) {
					this.adapter.log.error(`CronJobManager: Error parsing job config from state ${jobId}: ${error}`);
					return;
				}
			} else if (obj.native && (obj.native as any).cron) {
				config = obj.native as CronJobConfig;
				this.adapter.log.debug(`CronJobManager: Refreshed config from native object for job ${jobId}`);
			} else {
				this.adapter.log.debug(`CronJobManager: No valid config found for job ${jobId} during refresh`);
				return;
			}

			// Validate config
			if (!config.cron || !config.targets) {
				this.adapter.log.error(
					`CronJobManager: Invalid refreshed config for job ${jobId}: missing cron or targets`,
				);
				return;
			}

			// Check if job needs to be updated
			const existingJob = this.jobs.get(jobId);
			if (existingJob && JSON.stringify(existingJob.config) !== JSON.stringify(config)) {
				this.adapter.log.info(`CronJobManager: Config changed during refresh for job ${jobId}, updating job`);
				// Remove existing job completely before adding the new one
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
	private async executeJob(jobId: string): Promise<void> {
		const job = this.jobs.get(jobId);
		if (!job) {
			this.adapter.log.error(`CronJobManager: Job ${jobId} not found for execution`);
			return;
		}

		const startTime = new Date().toISOString();
		this.adapter.log.info(`CronJobManager: Executing job ${jobId}`);

		try {
			// Execute all targets
			this.adapter.log.debug(`CronJobManager: Job ${jobId} has ${job.config.targets.length} targets to execute`);
			for (const target of job.config.targets) {
				this.adapter.log.debug(`CronJobManager: Executing target ${target.id} with value ${target.value}`);
				await this.executeTarget(target);
			}

			// Update status
			const status: CronJobStatus = {
				lastRun: startTime,
				status: "success",
				nextRun:
					job.config.active && job.config.type === "recurring"
						? this.getNextRunTime(job.config.cron)
						: undefined,
			};

			job.status = status;
			await this.updateJobStatus(jobId, status);

			// Handle once-type jobs
			if (job.config.type === "once") {
				this.adapter.log.info(`CronJobManager: One-time job ${jobId} completed, deactivating`);
				job.config.active = false;
				if (job.task) {
					job.task.stop();
				}

				// Update the job state to inactive
				await this.updateJobConfig(jobId, job.config);
			}

			this.adapter.log.info(`CronJobManager: Job ${jobId} executed successfully`);
		} catch (error) {
			this.adapter.log.error(`CronJobManager: Error executing job ${jobId}: ${error}`);

			const errorStatus: CronJobStatus = {
				lastRun: startTime,
				status: "error",
				error: error instanceof Error ? error.message : String(error),
				nextRun:
					job.config.active && job.config.type === "recurring"
						? this.getNextRunTime(job.config.cron)
						: undefined,
			};

			job.status = errorStatus;
			await this.updateJobStatus(jobId, errorStatus);
		}
	}

	/**
	 * Execute a single target
	 */
	private async executeTarget(target: { id: string; value: any }): Promise<void> {
		try {
			// Set the state with proper acknowledgment
			await this.adapter.setForeignStateAsync(target.id, {
				val: target.value,
				ack: false,
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
	private async updateJobStatus(jobId: string, status: CronJobStatus): Promise<void> {
		try {
			// Create a status state instead of overwriting the job state
			const statusId = jobId + ".status";

			// Ensure the status object exists
			await this.adapter.setObjectNotExistsAsync(statusId, {
				type: "state",
				common: {
					name: "Job Status",
					type: "string",
					role: "json",
					read: true,
					write: false,
				},
				native: {},
			});

			// Set the status value
			await this.adapter.setStateAsync(statusId, {
				val: JSON.stringify(status),
				ack: true,
			});
		} catch (error) {
			this.adapter.log.error(`CronJobManager: Error updating status for ${jobId}: ${error}`);
		}
	}

	/**
	 * Update job config in ioBroker state
	 */
	private async updateJobConfig(jobId: string, config: CronJobConfig): Promise<void> {
		try {
			// Get current state
			const state = await this.adapter.getStateAsync(jobId);
			if (state) {
				// Update the state with new config in common.native
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
	private getNextRunTime(cronExpression: string): string | undefined {
		try {
			// This is a simplified implementation
			// In a real implementation, you'd use a proper cron parser
			const now = new Date();
			const nextRun = new Date(now.getTime() + 60000); // Simple: next minute
			return nextRun.toISOString();
		} catch (error) {
			this.adapter.log.error(`CronJobManager: Error calculating next run time: ${error}`);
			return undefined;
		}
	}

	/**
	 * Check for job state changes
	 */
	private async checkForJobChanges(): Promise<void> {
		try {
			const cronFolder = this.adapter.config.cronFolder || `${this.adapter.namespace}.jobs`;

			// Get all states in the cron folder
			const states = await this.adapter.getStatesAsync(`${cronFolder}.*`);

			if (!states) return;

			// Process each state
			for (const [stateId, state] of Object.entries(states)) {
				// Skip trigger states, status states and non-job states
				if (stateId.endsWith(".trigger") || stateId.endsWith(".status") || !state) continue;

				const jobId = stateId;

				// Get job configuration from object
				const obj = await this.adapter.getObjectAsync(jobId);
				if (!obj) continue;

				let config: CronJobConfig;

				// Try to get config from state value first, then from native as fallback
				if ((state as any).val && typeof (state as any).val === "string") {
					try {
						config = JSON.parse((state as any).val) as CronJobConfig;
						this.adapter.log.debug(`CronJobManager: Using config from state value for job ${jobId}`);
					} catch (error) {
						this.adapter.log.error(
							`CronJobManager: Error parsing job config from state ${jobId}: ${error}`,
						);
						continue;
					}
				} else if (obj.native && (obj.native as any).cron) {
					config = obj.native as CronJobConfig;
					this.adapter.log.debug(`CronJobManager: Using config from native object for job ${jobId}`);
				} else {
					this.adapter.log.debug(`CronJobManager: No valid config found for job ${jobId}`);
					continue;
				}

				// Validate config
				if (!config.cron || !config.targets) {
					this.adapter.log.error(`CronJobManager: Invalid config for job ${jobId}: missing cron or targets`);
					continue;
				}

				// Check if job needs to be updated
				const existingJob = this.jobs.get(jobId);
				if (!existingJob || JSON.stringify(existingJob.config) !== JSON.stringify(config)) {
					// Remove existing job completely before adding the new one
					if (existingJob) {
						this.adapter.log.info(
							`CronJobManager: Configuration changed for job ${jobId}, removing old job`,
						);
						this.removeJob(jobId);
					}
					this.adapter.log.info(`CronJobManager: Adding job ${jobId} with new configuration`);
					await this.addOrUpdateJob(jobId, config);
				}
			}

			// Remove jobs that no longer exist
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
	public getJobsStatus(): Array<{ id: string; config: CronJobConfig; status: CronJobStatus }> {
		return Array.from(this.jobs.values()).map((job) => ({
			id: job.id,
			config: job.config,
			status: job.status,
		}));
	}
}
