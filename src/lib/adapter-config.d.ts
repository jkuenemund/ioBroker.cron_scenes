// This file extends the AdapterConfig type from "@types/iobroker"

// Augment the globally declared type ioBroker.AdapterConfig
declare global {
	namespace ioBroker {
		interface AdapterConfig {
			// Folder to monitor for cron job states
			cronFolder: string;
			// Interval in seconds to check for new/changed cron jobs
			checkInterval: number;
			// Enable detailed logging
			enableLogging: boolean;
		}
	}
}

// this is required so the above AdapterConfig is found by TypeScript / type checking
export {};
