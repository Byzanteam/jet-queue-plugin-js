import {
  clearJobs,
  findEnqueuedJob,
  getJobs,
  makeTestingFunctions,
} from "./testing.ts";
import { afterEach, assert, assertEquals, describe, it } from "../dev_deps.ts";

describe("Queue Testing Functions", () => {
  afterEach(() => {
    clearJobs();
  });

  it("should enqueue a job and retrieve it", async () => {
    const { enqueue } = makeTestingFunctions("testQueue", { instanceName: "" });

    const jobArgs = { task: "testTask" };
    const enqueueResult = await enqueue(jobArgs, {});
    assert(enqueueResult.id > 0, "Job ID should be a positive number");
    assertEquals(
      enqueueResult.is_conflict,
      false,
      "is_conflict should be false",
    );

    const jobs = getJobs();
    assertEquals(jobs.length, 1, "There should be one job enqueued");
    assertEquals(jobs[0][1].args, jobArgs, "Enqueued job args should match");

    const foundJob = findEnqueuedJob("testQueue", jobArgs);
    assert(foundJob, "Job should be found");
    assertEquals(foundJob?.[1].args, jobArgs, "Found job args should match");
  });

  it("should correctly handle the scheduleAt in options when enqueueing and finding a job", async () => {
    const { enqueue } = makeTestingFunctions("testQueue", { instanceName: "" });
    const jobArgs = { id: "projectId" };
    const scheduledAt = new Date();
    const updateScheduledAt = new Date();

    await enqueue(jobArgs, {
      scheduledAt,
    });

    await enqueue(jobArgs, {
      scheduledAt: updateScheduledAt,
      unique: { fields: ["args"], keys: ["id"] },
      replace: { scheduled: ["scheduled_at"] },
    });

    const jobs = getJobs();

    assertEquals(jobs.length, 1, "There should be one job enqueued");

    assertEquals(
      jobs[0][2]?.scheduledAt?.getTime(),
      updateScheduledAt.getTime(),
      "Enqueued job scheduleAt should match",
    );

    const foundJob = findEnqueuedJob("testQueue", jobArgs, { scheduledAt });

    assert(foundJob, "Job should be found");

    assertEquals(
      foundJob?.[2]?.scheduledAt?.getTime(),
      updateScheduledAt.getTime(),
      "Found job scheduledAt should match",
    );
  });

  it("should handle replacement correctly", async () => {
    const { enqueue } = makeTestingFunctions("testQueue", { instanceName: "" });
    const jobArgs = { id: "projectId" };
    const jobArgsTwo = { id: "projectIdTwo" };

    await enqueue(jobArgs, {
      priority: 1,
    });

    const foundJob = findEnqueuedJob("testQueue", jobArgs);
    assert(foundJob, "Job should be found");
    assertEquals(foundJob?.[2]?.priority, 1, "Priority should be 1");

    await enqueue(jobArgs, {
      priority: 2,
      unique: { fields: ["args"], keys: ["id"] },
      replace: { available: ["priority"] },
    });

    const foundJobTwo = findEnqueuedJob("testQueue", jobArgs);
    assert(foundJobTwo, "Job should be found");
    assertEquals(foundJobTwo?.[2]?.priority, 2, "Priority should be 2");

    await enqueue(jobArgsTwo, {
      scheduledAt: new Date(),
    });

    assertEquals(getJobs().length, 2, "There should be two jobs enqueued");
    const foundJobThree = findEnqueuedJob("testQueue", jobArgsTwo);
    assert(foundJobThree, "Job should be found");
    assert(foundJobThree?.[2]?.scheduledAt, "ScheduledAt should be found");
  });

  it("should handle clearing jobs correctly", () => {
    const { enqueue } = makeTestingFunctions("testQueue", { instanceName: "" });
    const jobArgs = { task: "testTask" };

    enqueue(jobArgs, {});

    clearJobs();
    const jobs = getJobs();
    assertEquals(jobs.length, 0, "Jobs should be cleared");
  });

  it("should cancel a job correctly", async () => {
    const { enqueue, cancel } = makeTestingFunctions("testQueue", {
      instanceName: "",
    });

    const jobArgs = { task: "testCancel" };
    const { id: jobId } = await enqueue(jobArgs, {});

    let foundJob = findEnqueuedJob("testQueue", jobArgs);
    assert(foundJob !== undefined, "The job should be enqueued successfully");

    await cancel(jobId);

    foundJob = findEnqueuedJob("testQueue", jobArgs);
    assertEquals(
      foundJob,
      undefined,
      "The job should be removed from the queue after cancellation",
    );
  });
});
