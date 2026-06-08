/**
 * Tests for CronJobManager reTriggerMode functionality
 */

import { expect } from "chai";
import * as sinon from "sinon";
import { CronJobManager } from "./CronJobManager";
import { CRON_JOB_TYPE, RE_TRIGGER_MODE } from "./constants";
import { AdapterInterface } from "./interfaces";

describe("CronJobManager - reTriggerMode", () => {
	let manager: CronJobManager;
	let mockAdapter: sinon.SinonStubbedInstance<AdapterInterface>;

	beforeEach(() => {
		// Create mock adapter
		mockAdapter = {
			log: {
				info: sinon.stub(),
				warn: sinon.stub(),
				error: sinon.stub(),
				debug: sinon.stub(),
			},
			setForeignStateAsync: sinon.stub().resolves() as any,
			getStateAsync: sinon.stub().resolves(null) as any,
			getObjectAsync: sinon.stub().resolves(null) as any,
			setObjectNotExistsAsync: sinon.stub().resolves() as any,
			setObjectAsync: sinon.stub().resolves() as any,
			delObjectAsync: sinon.stub().resolves() as any,
			getObjectListAsync: sinon.stub().resolves({ rows: [] }) as any,
			subscribeStates: sinon.stub() as any,
			unsubscribeStates: sinon.stub() as any,
			namespace: "test.0",
		} as any;

		manager = new CronJobManager(mockAdapter as any);
		manager.initialize();
	});

	afterEach(async () => {
		await manager.shutdown();
		sinon.restore();
	});

	describe("reTriggerMode: ignore", () => {
		it("should ignore new trigger when job is already running", async () => {
			const jobId = "test.0.jobs.testJob";
			const config = {
				type: CRON_JOB_TYPE.MANUAL,
				targets: [
					{
						id: "test.0.target1",
						value: true,
						delay: 100, // Short delay for testing
					},
				],
				active: true,
				reTriggerMode: RE_TRIGGER_MODE.IGNORE,
			};

			await manager.addOrUpdateJob(jobId, config);

			// Mock getStateAsync to return config when refreshJobConfig is called
			mockAdapter.getStateAsync = sinon.stub().resolves({
				val: JSON.stringify(config),
				ack: true,
				ts: Date.now(),
				q: 0,
			}) as any;

			// Start first execution (non-blocking)
			const firstExecution = manager.triggerJob(jobId);

			// Wait a bit to ensure job started
			await new Promise((resolve) => setTimeout(resolve, 10));

			// Try to trigger again while running
			await manager.triggerJob(jobId);

			// Check that ignore was logged
			expect(mockAdapter.log.info).to.have.been.calledWith(sinon.match(/ignoring trigger.*ignore/));

			// Wait for first execution to complete
			await firstExecution;
		});
	});

	describe("reTriggerMode: queue", () => {
		it("should queue new triggers when job is already running", async () => {
			const jobId = "test.0.jobs.testJob";
			const config = {
				type: CRON_JOB_TYPE.MANUAL,
				targets: [
					{
						id: "test.0.target1",
						value: true,
						delay: 200, // Longer delay to ensure job is still running
					},
				],
				active: true,
				reTriggerMode: RE_TRIGGER_MODE.QUEUE,
			};

			await manager.addOrUpdateJob(jobId, config);

			// Get the stored config from the manager to ensure exact match
			const storedJob = (manager as any).jobs.get(jobId);
			const storedConfigString = JSON.stringify(storedJob.config);

			// Mock getStateAsync to return the exact stored config
			mockAdapter.getStateAsync = sinon.stub().resolves({
				val: storedConfigString,
				ack: true,
				ts: Date.now(),
				q: 0,
			}) as any;

			// Start first execution (don't await)
			manager.triggerJob(jobId).catch(() => {});

			// Wait a bit to ensure job started and is in runningJobs
			await new Promise((resolve) => setTimeout(resolve, 20));

			// Trigger again - should be queued
			await manager.triggerJob(jobId);

			// Check that queue was logged
			expect(mockAdapter.log.info).to.have.been.calledWith(sinon.match(/queued for execution/));

			// Wait for executions to complete
			await new Promise((resolve) => setTimeout(resolve, 300));
		});

		it("should ignore triggers when queue is full (10 entries)", async () => {
			const jobId = "test.0.jobs.testJob";
			const config = {
				type: CRON_JOB_TYPE.MANUAL,
				targets: [
					{
						id: "test.0.target1",
						value: true,
						delay: 2000, // Very long delay to ensure job stays running
					},
				],
				active: true,
				reTriggerMode: RE_TRIGGER_MODE.QUEUE,
			};

			await manager.addOrUpdateJob(jobId, config);

			// Get the stored config from the manager to ensure exact match
			const storedJob = (manager as any).jobs.get(jobId);
			const storedConfigString = JSON.stringify(storedJob.config);

			// Mock getStateAsync to return the exact stored config
			mockAdapter.getStateAsync = sinon.stub().resolves({
				val: storedConfigString,
				ack: true,
				ts: Date.now(),
				q: 0,
			}) as any;

			// Start first execution (don't await)
			manager.triggerJob(jobId).catch(() => {});
			await new Promise((resolve) => setTimeout(resolve, 50));

			// Fill queue with 10 triggers - all should be added before first job completes
			for (let i = 0; i < 10; i++) {
				await manager.triggerJob(jobId);
			}

			// 11th trigger should be ignored
			await manager.triggerJob(jobId);

			// Check that queue full was logged
			expect(mockAdapter.log.warn).to.have.been.calledWith(sinon.match(/queue is full.*10 entries/));
		}).timeout(5000);
	});

	describe("reTriggerMode: cancel", () => {
		it("should cancel running job and start new execution", async () => {
			const jobId = "test.0.jobs.testJob";
			const config = {
				type: CRON_JOB_TYPE.MANUAL,
				targets: [
					{
						id: "test.0.target1",
						value: true,
						delay: 100,
					},
					{
						id: "test.0.target2",
						value: false,
						delay: 200,
					},
				],
				active: true,
				reTriggerMode: RE_TRIGGER_MODE.CANCEL,
			};

			await manager.addOrUpdateJob(jobId, config);

			// Mock getStateAsync to return config when refreshJobConfig is called
			mockAdapter.getStateAsync = sinon.stub().resolves({
				val: JSON.stringify(config),
				ack: true,
				ts: Date.now(),
				q: 0,
			}) as any;

			// Start first execution
			const firstExecution = manager.triggerJob(jobId);

			// Wait a bit to ensure first target started
			await new Promise((resolve) => setTimeout(resolve, 50));

			// Trigger again - should cancel and start new
			await manager.triggerJob(jobId);

			// Check that cancel was logged
			expect(mockAdapter.log.info).to.have.been.calledWith(sinon.match(/cancelled, starting new execution/));

			// Wait for executions to complete
			await firstExecution;
			await new Promise((resolve) => setTimeout(resolve, 300));
		});

		it("should skip remaining targets when cancelled", async () => {
			const jobId = "test.0.jobs.testJob";
			const config = {
				type: CRON_JOB_TYPE.MANUAL,
				targets: [
					{
						id: "test.0.target1",
						value: true,
						delay: 100,
					},
					{
						id: "test.0.target2",
						value: false,
						delay: 100,
					},
					{
						id: "test.0.target3",
						value: 42,
						delay: 100,
					},
				],
				active: true,
				reTriggerMode: RE_TRIGGER_MODE.CANCEL,
			};

			await manager.addOrUpdateJob(jobId, config);

			// Get the stored config from the manager to ensure exact match
			const storedJob = (manager as any).jobs.get(jobId);
			const storedConfigString = JSON.stringify(storedJob.config);

			// Mock getStateAsync to return the exact stored config
			mockAdapter.getStateAsync = sinon.stub().resolves({
				val: storedConfigString,
				ack: true,
				ts: Date.now(),
				q: 0,
			}) as any;

			// Start first execution (don't await)
			manager.triggerJob(jobId).catch(() => {});

			// Wait for first target to complete delay and start second target
			await new Promise((resolve) => setTimeout(resolve, 120));

			// Cancel by triggering again
			await manager.triggerJob(jobId);

			// Check that skip was logged (check for the exact message pattern)
			expect(mockAdapter.log.debug).to.have.been.calledWith(sinon.match(/Skipping target.*- job was cancelled/));

			await new Promise((resolve) => setTimeout(resolve, 300));
		});
	});

	describe("reTriggerMode: default (queue)", () => {
		it("should default to queue mode when reTriggerMode is not specified", async () => {
			const jobId = "test.0.jobs.testJob";
			const config = {
				type: CRON_JOB_TYPE.MANUAL,
				targets: [
					{
						id: "test.0.target1",
						value: true,
						delay: 200, // Longer delay to ensure job is still running
					},
				],
				active: true,
				// reTriggerMode not specified - should default to queue
			};

			await manager.addOrUpdateJob(jobId, config);

			// Get the stored config from the manager to ensure exact match
			const storedJob = (manager as any).jobs.get(jobId);
			const storedConfigString = JSON.stringify(storedJob.config);

			// Mock getStateAsync to return the exact stored config
			mockAdapter.getStateAsync = sinon.stub().resolves({
				val: storedConfigString,
				ack: true,
				ts: Date.now(),
				q: 0,
			}) as any;

			// Start first execution (don't await)
			manager.triggerJob(jobId).catch(() => {});
			await new Promise((resolve) => setTimeout(resolve, 20));

			// Trigger again - should be queued (default behavior)
			await manager.triggerJob(jobId);

			// Check that queue was logged
			expect(mockAdapter.log.info).to.have.been.calledWith(sinon.match(/queued for execution/));

			await new Promise((resolve) => setTimeout(resolve, 300));
		});
	});
});
