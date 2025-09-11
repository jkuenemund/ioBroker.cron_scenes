import * as cron from "node-cron";
import { CRON_ERROR_CODE, CRON_JOB_TYPE, CRON_TARGET_TYPE } from "./constants";
import { CronJobError } from "./errors";
import { CronJobConfig, CronTarget, CronTargetType } from "./interfaces";

/**
 * Validator for cron job configurations
 */
export class ConfigValidator {
	/**
	 * Validate a cron job configuration
	 */
	static validateCronJobConfig(config: any, jobId: string): CronJobConfig {
		if (!config || typeof config !== "object") {
			throw new CronJobError("Configuration must be an object", jobId, CRON_ERROR_CODE.CONFIG_INVALID);
		}

		// Validate job type first to determine if cron is required
		const jobType = config.type || CRON_JOB_TYPE.RECURRING;
		if (!Object.values(CRON_JOB_TYPE).includes(jobType)) {
			throw new CronJobError(
				`Invalid job type: ${jobType}. Must be one of: ${Object.values(CRON_JOB_TYPE).join(", ")}`,
				jobId,
				CRON_ERROR_CODE.CONFIG_INVALID,
			);
		}

		// Validate cron expression (not required for MANUAL jobs)
		if (jobType !== CRON_JOB_TYPE.MANUAL) {
			if (!config.cron || typeof config.cron !== "string") {
				throw new CronJobError(
					"Cron expression is required and must be a string for scheduled jobs",
					jobId,
					CRON_ERROR_CODE.CONFIG_INVALID,
				);
			}

			if (!cron.validate(config.cron)) {
				throw new CronJobError(`Invalid cron expression: ${config.cron}`, jobId, CRON_ERROR_CODE.INVALID_CRON);
			}
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
					`Target ${index} must have a valid 'id' property`,
					jobId,
					CRON_ERROR_CODE.CONFIG_INVALID,
				);
			}

			// Validate target type
			const targetType: CronTargetType = target.type || CRON_TARGET_TYPE.VALUE;
			if (!Object.values(CRON_TARGET_TYPE).includes(targetType)) {
				throw new CronJobError(
					`Target ${index} has invalid type '${target.type}'. Must be one of: ${Object.values(CRON_TARGET_TYPE).join(", ")}`,
					jobId,
					CRON_ERROR_CODE.CONFIG_INVALID,
				);
			}

			// Validate target value based on type
			if (targetType === CRON_TARGET_TYPE.STATE) {
				// State reference - validate it's a string
				if (typeof target.value !== "string") {
					throw new CronJobError(
						`Target ${index} with type 'state' must have a string value (state ID)`,
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

			// Validate delay if provided
			if (target.delay !== undefined) {
				if (typeof target.delay !== "number" || target.delay < 0 || target.delay > 60000) {
					throw new CronJobError(
						`Target ${index} delay must be a number between 0 and 60000 milliseconds`,
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
				delay: target.delay || undefined,
			};
		});

		// Validate active flag
		if (typeof config.active !== "boolean") {
			throw new CronJobError("Active flag must be a boolean", jobId, CRON_ERROR_CODE.CONFIG_INVALID);
		}

		return {
			cron: jobType !== CRON_JOB_TYPE.MANUAL ? config.cron : undefined,
			targets: validatedTargets,
			active: config.active,
			type: jobType,
		};
	}
}
