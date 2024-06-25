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

  it("should handle initial job enqueue and priority", async () => {
    const { enqueue } = makeTestingFunctions("testQueue", { instanceName: "" });

    // 初始化队列任务
    await enqueue({ id: "projectId" }, { priority: 1 });

    // 验证队列任务是否插入成功
    const initialJob = findEnqueuedJob("testQueue", { id: "projectId" });
    assert(initialJob, "Initial job should be found");
    assertEquals(
      initialJob?.[2]?.priority,
      1,
      "Initial job's priority should be 1",
    );

    // 尝试替换现有任务的优先级
    await enqueue({ id: "projectId" }, {
      priority: 2,
      unique: { fields: ["args"], keys: ["id"] },
      replace: { available: ["priority"] },
    });

    // 验证是否替换成功
    const updatedJob = findEnqueuedJob("testQueue", { id: "projectId" });
    assertEquals(
      updatedJob?.[2]?.priority,
      2,
      "Updated job's priority should be 2",
    );
  });

  it("should handle job scheduling and updating with unique metadata constraints", async () => {
    const { enqueue } = makeTestingFunctions("testQueue", {
      instanceName: "",
    });

    // 正常新入队任务
    await enqueue({ id: "projectIdTwo" }, {
      scheduledAt: new Date("2024-04-01"),
      meta: { name: "Joh" },
    });

    // 验证是否新入队任务成功
    const scheduledJob = findEnqueuedJob("testQueue", { id: "projectIdTwo" });
    assert(scheduledJob, "Scheduled job should be found");

    // 替换现有任务的调度时间
    await enqueue({ id: "projectIdTwo" }, {
      meta: { name: "Joh" },
      scheduledAt: new Date("2024-04-02"),
      unique: { fields: ["meta"], keys: ["name"] },
      replace: { scheduled: ["scheduled_at"] },
    });

    // 验证调度时间是否被替换成功
    const updatedScheduledJob = findEnqueuedJob("testQueue", {
      id: "projectIdTwo",
    });
    assert(updatedScheduledJob, "Updated scheduled job should be found");
    assertEquals(updatedScheduledJob[2]?.scheduledAt, new Date("2024-04-02"));
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
