import { CRON_JOB_TYPE } from "./constants";

/**
 * Example job configurations for demonstration
 */
export const EXAMPLE_JOBS = {
	recurring: {
		cron: "*/5 * * * *", // Every 5 minutes for demo
		targets: [
			{
				id: "cron_scenes.0.testVariable",
				type: "value",
				value: true,
				description: "Direct boolean value - executed immediately",
			},
			{
				id: "cron_scenes.0.testVariable2",
				type: "state",
				value: "cron_scenes.0.testVariable",
				description: "Copy value from another state",
				delay: 500,
			},
			{
				id: "cron_scenes.0.testVariable3",
				type: "value",
				value: 42,
				description: "Set number value after 1 second delay",
				delay: 1000,
			},
		],
		type: CRON_JOB_TYPE.RECURRING,
	},

	manual: {
		targets: [
			{
				id: "cron_scenes.0.testVariable",
				type: "value",
				value: false,
				description: "Manual trigger - set testVariable to false",
			},
			{
				id: "cron_scenes.0.testVariable",
				type: "value",
				value: true,
				description: "Manual trigger - set testVariable to true",
				delay: 250,
			},
		],
		type: CRON_JOB_TYPE.MANUAL,
	},

	state: {
		triggerState: "cron_scenes.0.testVariable",
		triggerValue: true,
		debounce: 200,
		targets: [
			{
				id: "cron_scenes.0.testVariable2",
				type: "value",
				value: true,
				description: "State-triggered - set testVariable2 when testVariable becomes true",
			},
		],
		type: CRON_JOB_TYPE.STATE,
	},
} as const;

/**
 * Create example job configuration
 */
export function createExampleJobConfig(type: keyof typeof EXAMPLE_JOBS, active: boolean): any {
	return {
		...EXAMPLE_JOBS[type],
		active,
	};
}
