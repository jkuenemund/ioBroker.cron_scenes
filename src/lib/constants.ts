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
	MANUAL: "manual",
	STATE: "state",
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
