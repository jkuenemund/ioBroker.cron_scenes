import * as cron from "node-cron";
import { ConfigValidator } from "./ConfigValidator";
import { CRON_JOB_STATUS, CRON_JOB_TYPE, CRON_TARGET_TYPE } from "./constants";
import { CRON_ERROR_CODE, CronJobError } from "./errors";
import { AdapterInterface, CronJobConfig, CronJobStatus, CronTarget, RegisteredCronJob } from "./interfaces";

// Re-export for backward compatibility
export { CRON_ERROR_CODE, CRON_JOB_STATUS, CRON_JOB_TYPE, CRON_TARGET_TYPE, CronJobError };
export type { AdapterInterface, CronJobConfig, CronJobStatus, CronTarget, RegisteredCronJob };

/**
 * CronJobManager - Manages cron jobs for the adapter
 */
export class CronJobManager {
	private jobs = new Map<string, RegisteredCronJob>();

	constructor(private adapter: AdapterInterface) {}

	/**
	 * Initialize the cron job manager
	 */
	public initialize(): void {
		this.adapter.log.info("CronJobManager: Initializing...");
		this.adapter.log.info("CronJobManager: Initialized (event-driven mode)");
	}

	/**
	 * Shutdown the cron job manager
	 */
	public async shutdown(): Promise<void> {
		this.adapter.log.info("CronJobManager: Shutting down...");

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
	public async addOrUpdateJob(jobId: string, config: any): Promise<void> {
		try {
			this.adapter.log.debug(`CronJobManager: Adding/updating job ${jobId}`);

			// Validate and sanitize configuration
			const validatedConfig = ConfigValidator.validateCronJobConfig(config, jobId);

			// Stop existing job if it exists
			const existingJob = this.jobs.get(jobId);
			if (existingJob?.task) {
				existingJob.task.stop();
			}

			// Create new job
			const newJob: RegisteredCronJob = {
				id: jobId,
				config: { ...validatedConfig },
				status: {
					status: CRON_JOB_STATUS.PENDING,
					nextRun:
						validatedConfig.active && validatedConfig.type !== CRON_JOB_TYPE.MANUAL && validatedConfig.cron
							? this.getNextRunTime(validatedConfig.cron)
							: undefined,
				},
			};

			// Create and start cron task if active and not manual
			if (validatedConfig.active && validatedConfig.type !== CRON_JOB_TYPE.MANUAL && validatedConfig.cron) {
				newJob.task = cron.schedule(validatedConfig.cron, () => {
					this.executeJob(jobId);
				});

				this.adapter.log.info(`CronJobManager: Started job ${jobId} with cron '${validatedConfig.cron}'`);
			} else if (validatedConfig.type === CRON_JOB_TYPE.MANUAL) {
				this.adapter.log.info(`CronJobManager: Manual job ${jobId} created - trigger only execution`);
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
					name: `Manual trigger for ${jobId}`,
					type: "boolean",
					role: "button",
					read: false,
					write: true,
					desc: "Set to true to manually trigger this job",
				},
				native: {},
			});

			// Create status object if it doesn't exist
			const statusId = jobId + ".status";
			await this.adapter.setObjectNotExistsAsync(statusId, {
				type: "state",
				common: {
					name: `Status for ${jobId}`,
					type: "string",
					role: "json",
					read: true,
					write: false,
					desc: "Current status of this job",
				},
				native: {},
			});

			// Update status
			await this.updateJobStatus(jobId, newJob.status);
		} catch (error) {
			this.adapter.log.error(`CronJobManager: Error adding/updating job ${jobId}: ${error}`);
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
	 * Get all registered jobs
	 */
	public getJobs(): Map<string, RegisteredCronJob> {
		return new Map(this.jobs);
	}

	/**
	 * Handle state changes for job configurations
	 */
	public async handleJobStateChange(jobId: string, state: any): Promise<void> {
		try {
			if (!state || !state.val) {
				this.adapter.log.debug(`CronJobManager: Ignoring empty state change for ${jobId}`);
				return;
			}

			// Parse configuration
			let config: any;
			try {
				config = JSON.parse(state.val);
			} catch (parseError) {
				this.adapter.log.error(`CronJobManager: Invalid JSON configuration for job ${jobId}: ${parseError}`);
				return;
			}

			// Check if job needs to be updated
			const existingJob = this.jobs.get(jobId);
			if (!existingJob || JSON.stringify(existingJob.config) !== JSON.stringify(config)) {
				// Remove existing job completely before adding the new one
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
	public async triggerJob(jobId: string): Promise<void> {
		try {
			this.adapter.log.info(`CronJobManager: Manual trigger requested for job ${jobId}`);

			// First, refresh the job configuration to ensure we have the latest version
			await this.refreshJobConfig(jobId);

			const job = this.jobs.get(jobId);
			if (!job) {
				throw new CronJobError(`Job ${jobId} not found`, jobId, CRON_ERROR_CODE.TARGET_NOT_FOUND);
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
	private async refreshJobConfig(jobId: string): Promise<void> {
		try {
			const stateObj = await this.adapter.getStateAsync(jobId);
			if (!stateObj || !stateObj.val) {
				this.adapter.log.warn(
					`CronJobManager: No configuration found for job ${jobId} during refresh, keeping existing config`,
				);
				return;
			}

			// Parse configuration
			let config: any;
			try {
				config = JSON.parse(stateObj.val as string);
			} catch (parseError) {
				this.adapter.log.error(
					`CronJobManager: Invalid JSON configuration for job ${jobId} during refresh: ${parseError}`,
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
		const startTime = new Date().toISOString();

		try {
			const job = this.jobs.get(jobId);
			if (!job) {
				throw new CronJobError(`Job ${jobId} not found`, jobId, CRON_ERROR_CODE.TARGET_NOT_FOUND);
			}

			this.adapter.log.info(`CronJobManager: Executing job ${jobId}`);

			// Execute all targets
			for (const target of job.config.targets) {
				this.adapter.log.debug(`CronJobManager: Executing target ${target.id} with value ${target.value}`);
				await this.executeTarget(target);
			}

			// Update status
			const status: CronJobStatus = {
				lastRun: startTime,
				status: CRON_JOB_STATUS.SUCCESS,
				nextRun:
					job.config.active && job.config.type === CRON_JOB_TYPE.RECURRING && job.config.cron
						? this.getNextRunTime(job.config.cron)
						: undefined,
			};

			job.status = status;
			await this.updateJobStatus(jobId, status);

			// Handle once-type jobs
			if (job.config.type === CRON_JOB_TYPE.ONCE) {
				this.adapter.log.info(`CronJobManager: One-time job ${jobId} completed, deactivating`);
				job.config.active = false;
				if (job.task) {
					job.task.stop();
					job.task = undefined;
				}
			}

			this.adapter.log.info(`CronJobManager: Job ${jobId} executed successfully`);
		} catch (error) {
			this.adapter.log.error(`CronJobManager: Error executing job ${jobId}: ${error}`);

			const job = this.jobs.get(jobId);
			const errorStatus: CronJobStatus = {
				lastRun: startTime,
				status: CRON_JOB_STATUS.ERROR,
				error: error instanceof Error ? error.message : String(error),
				nextRun:
					job?.config.active && job.config.type === CRON_JOB_TYPE.RECURRING && job.config.cron
						? this.getNextRunTime(job.config.cron)
						: undefined,
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
	private async executeTarget(target: CronTarget): Promise<void> {
		try {
			// Apply delay if specified
			if (target.delay && target.delay > 0) {
				this.adapter.log.debug(`CronJobManager: Delaying execution of ${target.id} by ${target.delay}ms`);
				await new Promise((resolve) => setTimeout(resolve, target.delay));
			}

			// Resolve the target value based on type
			const resolvedValue = await this.resolveTargetValue(target);

			// Set the state with proper acknowledgment
			await this.adapter.setForeignStateAsync(target.id, {
				val: resolvedValue,
				ack: false,
			});
			this.adapter.log.debug(
				`CronJobManager: Set ${target.id} = ${resolvedValue} (type: ${target.type || CRON_TARGET_TYPE.VALUE})${target.delay ? ` after ${target.delay}ms delay` : ""}`,
			);
		} catch (error) {
			const errorMessage = `Error setting ${target.id}: ${error instanceof Error ? error.message : String(error)}`;
			this.adapter.log.error(`CronJobManager: ${errorMessage}`);
			throw new CronJobError(
				errorMessage,
				target.id,
				CRON_ERROR_CODE.EXECUTION_FAILED,
				error instanceof Error ? error : undefined,
			);
		}
	}

	/**
	 * Resolve target value based on type
	 */
	private async resolveTargetValue(target: CronTarget): Promise<any> {
		const targetType = target.type || CRON_TARGET_TYPE.VALUE;

		switch (targetType) {
			case CRON_TARGET_TYPE.VALUE:
				// Direct value
				return target.value;

			case CRON_TARGET_TYPE.STATE:
				// Get value from another state
				try {
					const sourceState = await this.adapter.getStateAsync(target.value as string);
					if (sourceState === null || sourceState === undefined) {
						this.adapter.log.warn(`CronJobManager: Source state ${target.value} not found, using null`);
						return null;
					}
					return sourceState.val;
				} catch (error) {
					this.adapter.log.error(`CronJobManager: Error reading source state ${target.value}: ${error}`);
					throw error;
				}

			default:
				throw new CronJobError(`Unknown target type: ${targetType}`, target.id, CRON_ERROR_CODE.CONFIG_INVALID);
		}
	}

	/**
	 * Update job status
	 */
	private async updateJobStatus(jobId: string, status: CronJobStatus): Promise<void> {
		try {
			const statusId = jobId + ".status";
			await this.adapter.setForeignStateAsync(statusId, {
				val: JSON.stringify(status, null, 2),
				ack: true,
			});
		} catch (error) {
			this.adapter.log.error(`CronJobManager: Error updating status for job ${jobId}: ${error}`);
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
			this.adapter.log.warn(`CronJobManager: Error calculating next run time for '${cronExpression}': ${error}`);
			return undefined;
		}
	}
}
