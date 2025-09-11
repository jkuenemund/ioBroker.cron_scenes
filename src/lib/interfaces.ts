import { CronJobStatusType, CronJobTypeType, CronTargetType } from "./constants";

export type { CronTargetType };

/**
 * Interface for a cron job target
 */
export interface CronTarget {
	id: string;
	type?: CronTargetType; // Optional for backward compatibility
	value: string | number | boolean | null;
	description?: string;
	delay?: number; // Optional delay in milliseconds before executing this target
}

/**
 * Interface for a cron job configuration
 */
export interface CronJobConfig {
	cron?: string; // Optional for MANUAL jobs
	targets: CronTarget[];
	active: boolean;
	type: CronJobTypeType;
}

/**
 * Interface for a cron job status
 */
export interface CronJobStatus {
	status: CronJobStatusType;
	lastRun?: string;
	nextRun?: string;
	error?: string;
}

/**
 * Interface for a registered cron job
 */
export interface RegisteredCronJob {
	id: string;
	config: CronJobConfig;
	task?: any; // node-cron task
	status: CronJobStatus;
}

/**
 * Interface for the adapter instance used by CronJobManager
 */
export interface AdapterInterface {
	log: {
		info: (message: string) => void;
		warn: (message: string) => void;
		error: (message: string) => void;
		debug: (message: string) => void;
	};
	setForeignStateAsync: (id: string, state: any) => any;
	getStateAsync: (id: string) => any;
	getObjectAsync: (id: string) => any;
	setObjectNotExistsAsync: (id: string, obj: any) => any;
	setObjectAsync: (id: string, obj: any) => any;
	namespace: string;
}
