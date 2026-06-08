import CronExpressionParser from "cron-parser";
import * as cron from "node-cron";
import { CRON_ERROR_CODE, CRON_JOB_TYPE, CRON_TARGET_TYPE, RE_TRIGGER_MODE } from "./constants";
import { CronJobError } from "./errors";
import { CronJobConfig, CronTarget, CronTargetType } from "./interfaces";

/**
 * Validator for cron job configurations
 */
export class ConfigValidator {
	/**
	 * Parse delay value from number or string format to milliseconds
	 * Supports formats: number (ms), "100ms", "1s", "5m", "1h", "1h 30m", "1h 30m 15s"
	 */
	static parseDelay(delay: number | string | undefined): number | undefined {
		if (delay === undefined) {
			return undefined;
		}

		// If it's already a number, assume milliseconds (backward compatibility)
		if (typeof delay === "number") {
			return delay;
		}

		// Parse string format
		if (typeof delay !== "string") {
			throw new Error("Delay must be a number or string");
		}

		const trimmed = delay.trim().toLowerCase();
		if (!trimmed) {
			return undefined;
		}

		// Pattern: matches "1h 30m 15s 100ms" or similar combinations
		const timePattern =
			/(\d+)\s*(h|m|s|ms|hour|hours|min|mins|minute|minutes|sec|secs|second|seconds|millisecond|milliseconds)/g;
		let totalMs = 0;
		let match;

		while ((match = timePattern.exec(trimmed)) !== null) {
			const value = parseInt(match[1], 10);
			const unit = match[2];

			switch (unit) {
				case "h":
				case "hour":
				case "hours":
					totalMs += value * 60 * 60 * 1000;
					break;
				case "m":
				case "min":
				case "mins":
				case "minute":
				case "minutes":
					totalMs += value * 60 * 1000;
					break;
				case "s":
				case "sec":
				case "secs":
				case "second":
				case "seconds":
					totalMs += value * 1000;
					break;
				case "ms":
				case "millisecond":
				case "milliseconds":
					totalMs += value;
					break;
			}
		}

		if (totalMs === 0 && trimmed.match(/^\d+$/)) {
			// If it's just a number without unit, assume milliseconds
			totalMs = parseInt(trimmed, 10);
		}

		if (totalMs === 0) {
			throw new Error(`Invalid delay format: ${delay}`);
		}

		return totalMs;
	}

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

		// Validate cron expression (not required for MANUAL, STATE, and TIMER jobs)
		if (jobType !== CRON_JOB_TYPE.MANUAL && jobType !== CRON_JOB_TYPE.STATE && jobType !== CRON_JOB_TYPE.TIMER) {
			if (!config.cron || typeof config.cron !== "string") {
				throw new CronJobError(
					"Cron expression is required and must be a string for scheduled jobs",
					jobId,
					CRON_ERROR_CODE.CONFIG_INVALID,
				);
			}

			// Normalize cron expression: convert problematic day-of-week ranges
			// node-cron with timezone option doesn't execute ranges like 1-7 or 0-7 correctly
			// Convert them to 0-6 (all days) or * (all days)
			let normalizedCron = config.cron;
			const dayOfWeekPattern = /^(\S+\s+\S+\s+\S+\s+\S+\s+)([0-7,\-*\/]+)$/;
			const match = normalizedCron.match(dayOfWeekPattern);
			if (match) {
				const dayOfWeek = match[2];
				// Convert problematic ranges
				if (dayOfWeek === "1-7" || dayOfWeek === "0-7") {
					normalizedCron = match[1] + "*"; // Convert to * (all days)
				} else if (dayOfWeek.includes("7") && !dayOfWeek.includes("0")) {
					// If 7 is used without 0, replace 7 with 0 (both are Sunday)
					normalizedCron = match[1] + dayOfWeek.replace(/7/g, "0");
				}
			}

			if (!cron.validate(normalizedCron)) {
				throw new CronJobError(`Invalid cron expression: ${config.cron}`, jobId, CRON_ERROR_CODE.INVALID_CRON);
			}

			// Also validate with cron-parser to ensure consistency between both libraries
			try {
				CronExpressionParser.parse(normalizedCron, {
					tz: "Europe/Berlin",
				});
			} catch (parseError) {
				throw new CronJobError(
					`Invalid cron expression: ${config.cron}. ${parseError instanceof Error ? parseError.message : String(parseError)}`,
					jobId,
					CRON_ERROR_CODE.INVALID_CRON,
				);
			}

			// Use normalized cron expression for the validated config
			config.cron = normalizedCron;
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
			} else if (targetType === CRON_TARGET_TYPE.TOGGLE) {
				// Toggle inverts the current value of the target state itself - no value field needed
			}

			// Validate and parse delay if provided
			let parsedDelay: number | undefined;
			if (target.delay !== undefined) {
				try {
					parsedDelay = ConfigValidator.parseDelay(target.delay);
					if (parsedDelay === undefined) {
						parsedDelay = 0;
					}
					if (parsedDelay < 0 || parsedDelay > 3600000) {
						throw new CronJobError(
							`Target ${index} delay must be between 0 and 3600000 milliseconds (1 hour)`,
							jobId,
							CRON_ERROR_CODE.CONFIG_INVALID,
						);
					}
				} catch (error) {
					if (error instanceof CronJobError) {
						throw error;
					}
					throw new CronJobError(
						`Target ${index} delay is invalid: ${error instanceof Error ? error.message : String(error)}`,
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
				delay: parsedDelay,
			};
		});

		// Validate active flag
		if (typeof config.active !== "boolean") {
			throw new CronJobError("Active flag must be a boolean", jobId, CRON_ERROR_CODE.CONFIG_INVALID);
		}

		// Validate STATE job specific fields
		if (jobType === CRON_JOB_TYPE.STATE) {
			// triggerState is required for STATE jobs
			if (!config.triggerState || typeof config.triggerState !== "string") {
				throw new CronJobError(
					"triggerState is required and must be a string for STATE jobs",
					jobId,
					CRON_ERROR_CODE.CONFIG_INVALID,
				);
			}

			// Validate debounce if provided
			if (config.debounce !== undefined) {
				if (typeof config.debounce !== "number" || config.debounce < 0 || config.debounce > 60000) {
					throw new CronJobError(
						"debounce must be a number between 0 and 60000 milliseconds",
						jobId,
						CRON_ERROR_CODE.CONFIG_INVALID,
					);
				}
			}

			// Validate triggerOnChange if provided
			if (config.triggerOnChange !== undefined && typeof config.triggerOnChange !== "boolean") {
				throw new CronJobError(
					"triggerOnChange must be a boolean if provided",
					jobId,
					CRON_ERROR_CODE.CONFIG_INVALID,
				);
			}

			// triggerValue can be any type (no validation needed)
		}

		// Validate TIMER job specific fields
		if (jobType === CRON_JOB_TYPE.TIMER) {
			// delay is required for TIMER jobs
			if (config.delay === undefined || typeof config.delay !== "number") {
				throw new CronJobError(
					"delay is required and must be a number (in seconds) for TIMER jobs",
					jobId,
					CRON_ERROR_CODE.CONFIG_INVALID,
				);
			}

			// Validate delay value
			if (config.delay <= 0 || config.delay > 86400) {
				throw new CronJobError(
					"delay must be a positive number between 1 and 86400 seconds (24 hours)",
					jobId,
					CRON_ERROR_CODE.CONFIG_INVALID,
				);
			}

			// cron is not allowed for TIMER jobs (they use relative time)
			if (config.cron !== undefined) {
				throw new CronJobError(
					"cron expression is not allowed for TIMER jobs (use delay instead)",
					jobId,
					CRON_ERROR_CODE.CONFIG_INVALID,
				);
			}
		}

		// Validate reTriggerMode if provided
		if (config.reTriggerMode !== undefined) {
			if (!Object.values(RE_TRIGGER_MODE).includes(config.reTriggerMode)) {
				throw new CronJobError(
					`reTriggerMode must be one of: ${Object.values(RE_TRIGGER_MODE).join(", ")}`,
					jobId,
					CRON_ERROR_CODE.CONFIG_INVALID,
				);
			}
		}

		return {
			cron:
				jobType !== CRON_JOB_TYPE.MANUAL && jobType !== CRON_JOB_TYPE.STATE && jobType !== CRON_JOB_TYPE.TIMER
					? config.cron
					: undefined,
			targets: validatedTargets,
			active: config.active,
			type: jobType,
			triggerState: config.triggerState,
			triggerValue: config.triggerValue,
			triggerOnChange: config.triggerOnChange,
			debounce: config.debounce,
			delay: config.delay,
			reTriggerMode: config.reTriggerMode || RE_TRIGGER_MODE.QUEUE, // Default to queue
		};
	}
}
