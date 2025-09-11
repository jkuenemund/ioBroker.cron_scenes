import * as cron from "node-cron";

/**
 * Constants for cron job status and types
 */
export const CRON_JOB_STATUS = {
	SUCCESS: "success",
	ERROR: "error",
	PENDING: "pending",
} as const;

export const CRON_JOB_TYPE = {
	ONCE: "once",
	RECURRING: "recurring",
} as const;

export const CRON_TARGET_TYPE = {
	VALUE: "value",
	STATE: "state",
} as const;

export type CronJobStatusType = (typeof CRON_JOB_STATUS)[keyof typeof CRON_JOB_STATUS];
export type CronJobTypeType = (typeof CRON_JOB_TYPE)[keyof typeof CRON_JOB_TYPE];
export type CronTargetType = (typeof CRON_TARGET_TYPE)[keyof typeof CRON_TARGET_TYPE];

/**
 * Custom error types for better error handling
 */
export const CRON_ERROR_CODE = {
	INVALID_CRON: "INVALID_CRON",
	TARGET_NOT_FOUND: "TARGET_NOT_FOUND",
	EXECUTION_FAILED: "EXECUTION_FAILED",
	CONFIG_INVALID: "CONFIG_INVALID",
} as const;

export type CronErrorCode = (typeof CRON_ERROR_CODE)[keyof typeof CRON_ERROR_CODE];

export class CronJobError extends Error {
	constructor(
		message: string,
		public readonly jobId: string,
		public readonly code: CronErrorCode,
		public readonly originalError?: Error,
	) {
		super(message);
		this.name = "CronJobError";
	}
}

/**
 * Configuration validation utilities
 */
export class ConfigValidator {
	/**
	 * Validate a cron job configuration
	 */
	static validateCronJobConfig(config: any, jobId: string): CronJobConfig {
		if (!config || typeof config !== "object") {
			throw new CronJobError("Configuration must be an object", jobId, CRON_ERROR_CODE.CONFIG_INVALID);
		}

		// Validate cron expression
		if (!config.cron || typeof config.cron !== "string") {
			throw new CronJobError(
				"Cron expression is required and must be a string",
				jobId,
				CRON_ERROR_CODE.CONFIG_INVALID,
			);
		}

		if (!cron.validate(config.cron)) {
			throw new CronJobError(`Invalid cron expression: ${config.cron}`, jobId, CRON_ERROR_CODE.INVALID_CRON);
		}

		// Validate targets
		if (!Array.isArray(config.targets) || config.targets.length === 0) {
			throw new CronJobError("Targets must be a non-empty array", jobId, CRON_ERROR_CODE.CONFIG_INVALID);
		}

		const validatedTargets: CronTarget[] = config.targets.map((target: any, index: number) => {
			if (!target || typeof target !== "object") {
				throw new CronJobError(`Target ${index} must be an object`, jobId, CRON_ERROR_CODE.CONFIG_INVALID);
			}

			if (!target.id || typeof target.id !== "string") {
				throw new CronJobError(
					`Target ${index} id is required and must be a string`,
					jobId,
					CRON_ERROR_CODE.CONFIG_INVALID,
				);
			}

			if (target.value === undefined) {
				throw new CronJobError(`Target ${index} value is required`, jobId, CRON_ERROR_CODE.CONFIG_INVALID);
			}

			// Validate type field (optional, defaults to "value")
			const targetType = target.type || CRON_TARGET_TYPE.VALUE;
			if (!Object.values(CRON_TARGET_TYPE).includes(targetType)) {
				throw new CronJobError(
					`Target ${index} type must be one of: ${Object.values(CRON_TARGET_TYPE).join(", ")}`,
					jobId,
					CRON_ERROR_CODE.CONFIG_INVALID,
				);
			}

			// Validate value based on type
			if (targetType === CRON_TARGET_TYPE.STATE) {
				// State reference must be a string
				if (typeof target.value !== "string" || !target.value.trim()) {
					throw new CronJobError(
						`Target ${index} with type 'state' must have a non-empty string value (state ID)`,
						jobId,
						CRON_ERROR_CODE.CONFIG_INVALID,
					);
				}
			} else if (targetType === CRON_TARGET_TYPE.VALUE) {
				// Direct value - validate type
				const valueType = typeof target.value;
				if (!["string", "number", "boolean"].includes(valueType) && target.value !== null) {
					throw new CronJobError(
						`Target ${index} with type 'value' must be string, number, boolean, or null`,
						jobId,
						CRON_ERROR_CODE.CONFIG_INVALID,
					);
				}
			}

			return {
				id: target.id,
				type: targetType,
				value: target.value,
				description: target.description || undefined,
			};
		});

		// Validate active flag
		if (typeof config.active !== "boolean") {
			throw new CronJobError("Active flag must be a boolean", jobId, CRON_ERROR_CODE.CONFIG_INVALID);
		}

		// Validate type
		if (!config.type || !Object.values(CRON_JOB_TYPE).includes(config.type)) {
			throw new CronJobError(
				`Type must be one of: ${Object.values(CRON_JOB_TYPE).join(", ")}`,
				jobId,
				CRON_ERROR_CODE.CONFIG_INVALID,
			);
		}

		return {
			cron: config.cron,
			targets: validatedTargets,
			active: config.active,
			type: config.type,
		};
	}
}

/**
 * Interface for a cron job target
 */
export interface CronTarget {
	id: string;
	type?: CronTargetType; // Optional for backward compatibility
	value: string | number | boolean | null;
	description?: string;
}

/**
 * Interface for a cron job configuration
 */
export interface CronJobConfig {
	cron: string;
	targets: CronTarget[];
	active: boolean;
	type: CronJobTypeType;
}

/**
 * Interface for a cron job status
 */
export interface CronJobStatus {
	lastRun?: string;
	status: CronJobStatusType;
	nextRun?: string;
	error?: string | null;
}

/**
 * Interface for adapter methods used by CronJobManager
 */
export interface AdapterInterface {
	log: ioBroker.Logger;
	config: {
		cronFolder?: string;
		enableLogging?: boolean;
		defaultJobsActive?: boolean;
		maxConcurrentJobs?: number;
		jobTimeout?: number;
	};
	namespace: string;
	setState(id: string, state: ioBroker.SettableState): void;
	setStateAsync(id: string, state: ioBroker.SettableState): any;
	getStateAsync(id: string): any;
	getStatesAsync(pattern: string): any;
	getObjectAsync(id: string): any;
	setObjectAsync(id: string, obj: ioBroker.SettableObject): any;
	setObjectNotExistsAsync(id: string, obj: ioBroker.SettableObject): any;
	setForeignStateAsync(id: string, state: ioBroker.SettableState): any;
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
	private adapter: AdapterInterface;
	private jobs: Map<string, RegisteredCronJob> = new Map();

	constructor(adapter: AdapterInterface) {
		this.adapter = adapter;
	}

	/**
	 * Initialize the cron job manager
	 */
	public initialize(): void {
		this.adapter.log.info("CronJobManager: Initializing...");

		// Perform initial scan for existing jobs
		this.checkForJobChanges();

		this.adapter.log.info("CronJobManager: Initialized (event-driven mode)");
	}

	/**
	 * Shutdown the cron job manager
	 */
	public shutdown(): void {
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
					nextRun: validatedConfig.active ? this.getNextRunTime(validatedConfig.cron) : undefined,
				},
			};

			// Create and start cron task if active
			if (validatedConfig.active) {
				newJob.task = cron.schedule(validatedConfig.cron, () => {
					this.executeJob(jobId);
				});

				this.adapter.log.info(`CronJobManager: Started job ${jobId} with cron '${validatedConfig.cron}'`);
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
				status: CRON_JOB_STATUS.ERROR,
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
	 * Handle job state change (called from adapter onStateChange)
	 */
	public async handleJobStateChange(jobId: string): Promise<void> {
		try {
			this.adapter.log.debug(`CronJobManager: Handling state change for job ${jobId}`);

			// Get current state and object
			const state = await this.adapter.getStateAsync(jobId);
			const obj = await this.adapter.getObjectAsync(jobId);

			if (!state || !obj) {
				this.adapter.log.debug(`CronJobManager: State or object not found for job ${jobId}`);
				return;
			}

			let config: CronJobConfig;

			// Try to get config from state value first, then from native as fallback
			if ((state as any).val && typeof (state as any).val === "string") {
				try {
					config = JSON.parse((state as any).val) as CronJobConfig;
					this.adapter.log.debug(`CronJobManager: Using config from state value for job ${jobId}`);
				} catch (error) {
					this.adapter.log.error(`CronJobManager: Error parsing job config from state ${jobId}: ${error}`);
					return;
				}
			} else if (obj.native && (obj.native as any).cron) {
				config = obj.native as CronJobConfig;
				this.adapter.log.debug(`CronJobManager: Using config from native object for job ${jobId}`);
			} else {
				this.adapter.log.debug(`CronJobManager: No valid config found for job ${jobId}`);
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
		// Before triggering, ensure we have the latest configuration
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
				status: CRON_JOB_STATUS.SUCCESS,
				nextRun:
					job.config.active && job.config.type === CRON_JOB_TYPE.RECURRING
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
				}

				// Update the job state to inactive
				await this.updateJobConfig(jobId, job.config);
			}

			this.adapter.log.info(`CronJobManager: Job ${jobId} executed successfully`);
		} catch (error) {
			this.adapter.log.error(`CronJobManager: Error executing job ${jobId}: ${error}`);

			const errorStatus: CronJobStatus = {
				lastRun: startTime,
				status: CRON_JOB_STATUS.ERROR,
				error: error instanceof Error ? error.message : String(error),
				nextRun:
					job.config.active && job.config.type === CRON_JOB_TYPE.RECURRING
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
	private async executeTarget(target: CronTarget): Promise<void> {
		try {
			// Resolve the target value based on type
			const resolvedValue = await this.resolveTargetValue(target);

			// Set the state with proper acknowledgment
			await this.adapter.setForeignStateAsync(target.id, {
				val: resolvedValue,
				ack: false,
			});
			this.adapter.log.debug(
				`CronJobManager: Set ${target.id} = ${resolvedValue} (type: ${target.type || CRON_TARGET_TYPE.VALUE})`,
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
	private async resolveTargetValue(target: CronTarget): Promise<string | number | boolean | null> {
		const targetType = target.type || CRON_TARGET_TYPE.VALUE; // Default to "value" for backward compatibility

		switch (targetType) {
			case CRON_TARGET_TYPE.VALUE:
				// Direct value - return as is
				return target.value;

			case CRON_TARGET_TYPE.STATE:
				// State reference - resolve from ioBroker
				return await this.resolveStateReference(target.value as string, target.id);

			default:
				this.adapter.log.warn(
					`CronJobManager: Unknown target type '${targetType}' for target ${target.id}, using direct value`,
				);
				return target.value;
		}
	}

	/**
	 * Resolve state reference to actual state value
	 */
	private async resolveStateReference(stateId: string, targetId: string): Promise<string | number | boolean | null> {
		try {
			if (!stateId || typeof stateId !== "string") {
				throw new CronJobError(`Invalid state reference: ${stateId}`, targetId, CRON_ERROR_CODE.CONFIG_INVALID);
			}

			this.adapter.log.debug(`CronJobManager: Resolving state reference '${stateId}' for target ${targetId}`);

			// Get the referenced state
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
				error instanceof Error ? error : undefined,
			);
		}
	}

	/**
	 * Resolve JavaScript expression with secure sandbox
	 */

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
			this.adapter.setState(statusId, {
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
	 * Initial scan for existing jobs (called once during initialization)
	 */
	private async checkForJobChanges(): Promise<void> {
		try {
			const cronFolder = this.adapter.config.cronFolder || `${this.adapter.namespace}.jobs`;

			// Get all states in the cron folder
			const states = await this.adapter.getStatesAsync(`${cronFolder}.*`);
			if (!states) {
				this.adapter.log.debug("CronJobManager: No existing jobs found during initialization");
				return;
			}

			this.adapter.log.debug(`CronJobManager: Found ${Object.keys(states).length} states during initialization`);

			// Process each state
			for (const [stateId, state] of Object.entries(states)) {
				// Skip trigger states, status states and non-job states
				if (stateId.endsWith(".trigger") || stateId.endsWith(".status") || !state) continue;

				// Process this job using the new event-driven method
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
	public getJobsStatus(): Array<{ id: string; config: CronJobConfig; status: CronJobStatus }> {
		return Array.from(this.jobs.values()).map((job) => ({
			id: job.id,
			config: job.config,
			status: job.status,
		}));
	}
}
