import { CRON_ERROR_CODE, CronErrorCode } from "./constants";

export { CRON_ERROR_CODE };

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
