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
    assertEquals(foundJob?.args, jobArgs, "Found job args should match");
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
