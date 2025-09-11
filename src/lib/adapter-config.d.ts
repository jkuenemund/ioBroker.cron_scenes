// This file extends the AdapterConfig type from "@types/iobroker"

// Augment the globally declared type ioBroker.AdapterConfig
declare global {
	namespace ioBroker {
		interface AdapterConfig {
			// Folder to monitor for cron job states
			cronFolder: string;
			// Enable detailed logging
			enableLogging: boolean;
			// New jobs are active by default
			defaultJobsActive: boolean;
			// Maximum number of concurrent jobs
			maxConcurrentJobs: number;
			// Job timeout in seconds
			jobTimeout: number;
		}
	}
}

// this is required so the above AdapterConfig is found by TypeScript / type checking
export {};
