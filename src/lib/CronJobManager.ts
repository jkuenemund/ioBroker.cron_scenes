import CronExpressionParser from "cron-parser";
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
	private cleanupInterval: NodeJS.Timeout | null = null;
	private triggerStateSubscriptions = new Map<string, string[]>(); // triggerState -> [jobIds]
	private debounceTimers = new Map<string, NodeJS.Timeout>(); // jobId -> timer

	constructor(private adapter: AdapterInterface) {}

	/**
	 * Initialize the cron job manager
	 */
	public initialize(): void {
		this.adapter.log.info("CronJobManager: Initializing...");
		this.adapter.log.info("CronJobManager: Initialized (event-driven mode)");

		// Start periodic cleanup of orphaned objects
		this.startPeriodicCleanup();
	}

	/**
	 * Shutdown the cron job manager
	 */
	public async shutdown(): Promise<void> {
		this.adapter.log.info("CronJobManager: Shutting down...");

		// Stop cleanup interval
		if (this.cleanupInterval) {
			clearInterval(this.cleanupInterval);
			this.cleanupInterval = null;
		}

		// Stop all running jobs
		for (const [jobId, job] of this.jobs) {
			if (job.task) {
				job.task.stop();
				this.adapter.log.debug(`CronJobManager: Stopped job ${jobId}`);
			}
		}

		// Clean up all debounce timers
		for (const [jobId, timer] of this.debounceTimers) {
			clearTimeout(timer);
			this.adapter.log.debug(`CronJobManager: Cleaned up debounce timer for job ${jobId}`);
		}
		this.debounceTimers.clear();

		// Unsubscribe from all trigger states
		for (const [triggerState] of this.triggerStateSubscriptions) {
			this.adapter.unsubscribeStates(triggerState);
			this.adapter.log.debug(`CronJobManager: Unsubscribed from triggerState ${triggerState}`);
		}
		this.triggerStateSubscriptions.clear();

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

			// Try to preserve existing lastRun from status state
			let existingLastRun: string | undefined;
			try {
				const statusId = jobId + ".status";
				const statusState = await this.adapter.getStateAsync(statusId);
				if (statusState?.val) {
					try {
						const existingStatus = JSON.parse(statusState.val as string);
						if (existingStatus.lastRun) {
							existingLastRun = existingStatus.lastRun;
							this.adapter.log.debug(`CronJobManager: Preserving existing lastRun: ${existingLastRun}`);
						}
					} catch (parseError) {
						// Ignore parse errors, status will be recreated
					}
				}
			} catch (error) {
				// Status state doesn't exist yet or can't be read, that's ok
				this.adapter.log.debug(`CronJobManager: No existing status found for ${jobId}, creating new`);
			}

			// Determine nextRun based on job type and configuration
			let nextRun: string | undefined;
			if (validatedConfig.active && validatedConfig.type !== CRON_JOB_TYPE.MANUAL && validatedConfig.cron) {
				// For ONCE jobs: only set nextRun if not yet executed (no lastRun)
				if (validatedConfig.type === CRON_JOB_TYPE.ONCE) {
					if (!existingLastRun) {
						nextRun = this.getNextRunTime(validatedConfig.cron);
					}
					// If lastRun exists, don't set nextRun (job already executed)
				} else {
					// For RECURRING jobs: always set nextRun if active
					nextRun = this.getNextRunTime(validatedConfig.cron);
				}
			}

			// Create new job
			const newJob: RegisteredCronJob = {
				id: jobId,
				config: { ...validatedConfig },
				status: {
					status: CRON_JOB_STATUS.PENDING,
					lastRun: existingLastRun, // Preserve existing lastRun
					nextRun: nextRun,
				},
			};

			// Create and start cron task if active and not manual
			if (
				validatedConfig.active &&
				validatedConfig.type !== CRON_JOB_TYPE.MANUAL &&
				validatedConfig.type !== CRON_JOB_TYPE.STATE &&
				validatedConfig.cron
			) {
				newJob.task = cron.schedule(
					validatedConfig.cron,
					() => {
						this.executeJob(jobId);
					},
					{
						timezone: "Europe/Berlin", // Use MEZ/MESZ timezone
					},
				);

				this.adapter.log.info(
					`CronJobManager: Started job ${jobId} with cron '${validatedConfig.cron}' (MEZ/MESZ)`,
				);
			} else if (validatedConfig.type === CRON_JOB_TYPE.MANUAL) {
				this.adapter.log.info(`CronJobManager: Manual job ${jobId} created - trigger only execution`);
			} else if (validatedConfig.type === CRON_JOB_TYPE.STATE) {
				// Subscribe to trigger state for STATE jobs
				if (validatedConfig.active && validatedConfig.triggerState) {
					this.subscribeToTriggerState(validatedConfig.triggerState, jobId);
					this.adapter.log.info(
						`CronJobManager: State-triggered job ${jobId} created - monitoring ${validatedConfig.triggerState}`,
					);
				} else {
					this.adapter.log.info(
						`CronJobManager: State job ${jobId} created but not active or missing triggerState`,
					);
				}
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
				acl: {
					owner: "system.user.admin",
					ownerGroup: "system.group.administrator",
					object: 0x666, // rw-rw-rw- (alle können lesen und schreiben)
					state: 0x666, // rw-rw-rw- (alle können lesen und schreiben)
				},
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
				acl: {
					owner: "system.user.admin",
					ownerGroup: "system.group.administrator",
					object: 0x644, // rw-r--r-- (Owner: read+write, alle anderen: read)
					state: 0x644, // rw-r--r-- (Owner: read+write, alle anderen: read)
				},
			});

			// Update status
			await this.updateJobStatus(jobId, newJob.status);
		} catch (error) {
			this.adapter.log.error(`CronJobManager: Error adding/updating job ${jobId}: ${error}`);
			throw error;
		}
	}

	/**
	 * Remove a cron job and clean up associated objects
	 */
	public async removeJob(jobId: string): Promise<void> {
		const job = this.jobs.get(jobId);
		if (job) {
			if (job.task) {
				job.task.stop();
			}

			// Clean up STATE job subscriptions and debounce timers
			if (job.config.type === CRON_JOB_TYPE.STATE && job.config.triggerState) {
				this.unsubscribeFromTriggerState(job.config.triggerState, jobId);
			}

			// Clean up debounce timer
			const debounceTimer = this.debounceTimers.get(jobId);
			if (debounceTimer) {
				clearTimeout(debounceTimer);
				this.debounceTimers.delete(jobId);
				this.adapter.log.debug(`CronJobManager: Cleaned up debounce timer for job ${jobId}`);
			}

			this.jobs.delete(jobId);
			this.adapter.log.info(`CronJobManager: Removed job ${jobId}`);
		}

		// Clean up associated status and trigger objects
		await this.cleanupJobObjects(jobId);
	}

	/**
	 * Clean up status and trigger objects for a job
	 */
	private async cleanupJobObjects(jobId: string): Promise<void> {
		try {
			// Remove status object
			const statusId = jobId + ".status";
			await this.adapter.delObjectAsync(statusId);
			this.adapter.log.debug(`CronJobManager: Cleaned up status object ${statusId}`);

			// Remove trigger object
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
	public getJobs(): Map<string, RegisteredCronJob> {
		return new Map(this.jobs);
	}

	/**
	 * Subscribe to a trigger state for a job
	 */
	private subscribeToTriggerState(triggerState: string, jobId: string): void {
		const existingJobs = this.triggerStateSubscriptions.get(triggerState) || [];

		// Add jobId if not already present
		if (!existingJobs.includes(jobId)) {
			existingJobs.push(jobId);
			this.triggerStateSubscriptions.set(triggerState, existingJobs);
			this.adapter.log.debug(`CronJobManager: Added job ${jobId} to triggerState ${triggerState}`);
		}

		// Subscribe to state if this is the first job using this triggerState
		if (existingJobs.length === 1) {
			this.adapter.subscribeStates(triggerState);
			this.adapter.log.info(`CronJobManager: Subscribed to triggerState ${triggerState}`);
		}
	}

	/**
	 * Unsubscribe from a trigger state for a job
	 */
	private unsubscribeFromTriggerState(triggerState: string, jobId: string): void {
		const existingJobs = this.triggerStateSubscriptions.get(triggerState);

		if (!existingJobs) {
			return;
		}

		// Remove jobId from list
		const updatedJobs = existingJobs.filter((id) => id !== jobId);

		if (updatedJobs.length === 0) {
			// No more jobs using this triggerState - unsubscribe
			this.triggerStateSubscriptions.delete(triggerState);
			this.adapter.unsubscribeStates(triggerState);
			this.adapter.log.info(`CronJobManager: Unsubscribed from triggerState ${triggerState}`);
		} else {
			// Update list with remaining jobs
			this.triggerStateSubscriptions.set(triggerState, updatedJobs);
			this.adapter.log.debug(`CronJobManager: Removed job ${jobId} from triggerState ${triggerState}`);
		}
	}

	/**
	 * Get all job IDs that are triggered by a specific state
	 */
	public getJobsForTriggerState(triggerState: string): string[] | undefined {
		return this.triggerStateSubscriptions.get(triggerState);
	}

	/**
	 * Check if a state change should trigger a job
	 */
	private shouldTrigger(config: CronJobConfig, state: ioBroker.State): boolean {
		// If triggerValue is set, only trigger when state value matches
		if (config.triggerValue !== undefined) {
			return state.val === config.triggerValue;
		}

		// If triggerOnChange is false, don't trigger (shouldn't happen if triggerValue not set, but check anyway)
		if (config.triggerOnChange === false) {
			return false;
		}

		// Default: trigger on any change
		return true;
	}

	/**
	 * Check and trigger a state job with debouncing
	 */
	public checkAndTriggerStateJob(jobId: string, state: ioBroker.State): void {
		const job = this.jobs.get(jobId);
		if (!job) {
			this.adapter.log.warn(`CronJobManager: Job ${jobId} not found for state trigger`);
			return;
		}

		// Check if job is active
		if (!job.config.active) {
			this.adapter.log.debug(`CronJobManager: Job ${jobId} is not active, skipping trigger`);
			return;
		}

		// Check if this state change should trigger the job
		if (!this.shouldTrigger(job.config, state)) {
			this.adapter.log.debug(`CronJobManager: State change for ${jobId} does not match trigger conditions`);
			return;
		}

		// Apply debouncing
		const debounceDelay = job.config.debounce || 100; // Default 100ms

		// Clear existing timer if present
		const existingTimer = this.debounceTimers.get(jobId);
		if (existingTimer) {
			clearTimeout(existingTimer);
			this.adapter.log.debug(`CronJobManager: Cleared existing debounce timer for job ${jobId}`);
		}

		// Create new timer
		const timer = setTimeout(() => {
			this.debounceTimers.delete(jobId);
			this.executeJob(jobId).catch((error) => {
				this.adapter.log.error(`CronJobManager: Error executing state-triggered job ${jobId}: ${error}`);
			});
		}, debounceDelay);

		this.debounceTimers.set(jobId, timer);
		this.adapter.log.debug(
			`CronJobManager: Scheduled state-triggered job ${jobId} with ${debounceDelay}ms debounce`,
		);
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
				// Stop existing job but keep status/trigger objects when updating
				if (existingJob) {
					this.adapter.log.info(`CronJobManager: Configuration changed for job ${jobId}, stopping old job`);
					if (existingJob.task) {
						existingJob.task.stop();
					}
					this.jobs.delete(jobId);
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
				// Stop existing job but keep status/trigger objects when updating
				if (existingJob.task) {
					existingJob.task.stop();
				}
				this.jobs.delete(jobId);
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
		const startTime = this.toMEZ(new Date());

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
				// Remove nextRun for ONCE jobs after execution
				status.nextRun = undefined;
				await this.updateJobStatus(jobId, status);
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
	 * Convert a date to MEZ/MESZ (Europe/Berlin) timezone and return as ISO string
	 */
	private toMEZ(date: Date): string {
		// Create a date formatter for Berlin timezone
		const formatter = new Intl.DateTimeFormat("en-CA", {
			timeZone: "Europe/Berlin",
			year: "numeric",
			month: "2-digit",
			day: "2-digit",
			hour: "2-digit",
			minute: "2-digit",
			second: "2-digit",
			hour12: false,
		});

		// Format the date parts
		const parts = formatter.formatToParts(date);
		const year = parts.find((p) => p.type === "year")?.value;
		const month = parts.find((p) => p.type === "month")?.value;
		const day = parts.find((p) => p.type === "day")?.value;
		const hour = parts.find((p) => p.type === "hour")?.value;
		const minute = parts.find((p) => p.type === "minute")?.value;
		const second = parts.find((p) => p.type === "second")?.value;

		// Calculate timezone offset (automatically handles MEZ/MESZ switch)
		// Create a date in Berlin timezone and compare with UTC
		const berlinTimeString = date.toLocaleString("en-US", { timeZone: "Europe/Berlin" });
		const utcTimeString = date.toLocaleString("en-US", { timeZone: "UTC" });
		const berlinTime = new Date(berlinTimeString);
		const utcTime = new Date(utcTimeString);
		const offsetMs = berlinTime.getTime() - utcTime.getTime();
		const offsetHours = Math.floor(offsetMs / (1000 * 60 * 60));
		const offsetMinutes = Math.abs(Math.floor((offsetMs % (1000 * 60 * 60)) / (1000 * 60)));
		const offsetSign = offsetHours >= 0 ? "+" : "-";
		const offsetString = `${offsetSign}${Math.abs(offsetHours).toString().padStart(2, "0")}:${offsetMinutes.toString().padStart(2, "0")}`;

		// Return ISO format with Berlin timezone offset
		return `${year}-${month}-${day}T${hour}:${minute}:${second}${offsetString}`;
	}

	/**
	 * Get next run time for a cron expression in MEZ
	 */
	private getNextRunTime(cronExpression: string): string | undefined {
		try {
			// Parse the cron expression with Berlin timezone
			const interval = CronExpressionParser.parse(cronExpression, {
				tz: "Europe/Berlin",
			});
			const nextRun = interval.next();
			if (!nextRun) {
				return undefined;
			}
			// Convert to MEZ timezone string
			return this.toMEZ(nextRun.toDate());
		} catch (error) {
			this.adapter.log.warn(`CronJobManager: Error calculating next run time for '${cronExpression}': ${error}`);
			return undefined;
		}
	}

	/**
	 * Start periodic cleanup of orphaned objects
	 */
	private startPeriodicCleanup(): void {
		// Run cleanup every 5 minutes
		this.cleanupInterval = setInterval(
			async () => {
				await this.cleanupOrphanedObjects();
			},
			5 * 60 * 1000, // 5 minutes
		);

		this.adapter.log.debug("CronJobManager: Started periodic cleanup of orphaned objects");
	}

	/**
	 * Clean up orphaned status and trigger objects
	 */
	private async cleanupOrphanedObjects(): Promise<void> {
		try {
			this.adapter.log.debug("CronJobManager: Starting cleanup of orphaned objects");

			// Get all objects in the adapter namespace
			const objects = await this.adapter.getObjectListAsync({
				startkey: this.adapter.namespace,
				endkey: this.adapter.namespace + "\u9999",
			});

			const orphanedObjects: string[] = [];

			// Check for orphaned status and trigger objects
			for (const obj of objects.rows) {
				const objId = obj.id;

				// Check if this is a status or trigger object
				if (objId.endsWith(".status") || objId.endsWith(".trigger")) {
					// Extract the job ID by removing the suffix
					const jobId = objId.replace(/\.(status|trigger)$/, "");

					// Check if the corresponding job exists
					if (!this.jobs.has(jobId)) {
						// Check if the job state object exists
						const jobStateExists = await this.checkJobStateExists(jobId);
						if (!jobStateExists) {
							orphanedObjects.push(objId);
						}
					}
				}
			}

			// Remove orphaned objects
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
	private async checkJobStateExists(jobId: string): Promise<boolean> {
		try {
			const state = await this.adapter.getStateAsync(jobId);
			return state !== null && state !== undefined;
		} catch (error) {
			return false;
		}
	}
}
