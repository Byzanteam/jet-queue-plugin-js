import { describe, it } from "https://deno.land/std@0.208.0/testing/bdd.ts";
import {
  assert,
  assertEquals,
} from "https://deno.land/std@0.208.0/assert/mod.ts";
import { JetQueueTesting } from "./testing.ts";

describe("JetQueueTesting", () => {
  it("should enqueue a job correctly", async () => {
    const jetQueue = new JetQueueTesting("testQueue", { instanceName: "" });
    const jobArgs = { id: "time-slot-test-id", scheduleAt: new Date() };
    const response = await jetQueue.enqueue(jobArgs);

    assert(jetQueue.assertEnqueued(jobArgs));
    assertEquals(response.is_conflict, false);
    assert(response.id > 0);
  });

  it("should verify job presence correctly", () => {
    const jetQueue = new JetQueueTesting("testQueue", { instanceName: "" });
    const date = new Date();
    const jobArgs = { id: "time-slot-test-id", scheduleAt: date };
    jetQueue.enqueue(jobArgs);

    assert(jetQueue.assertEnqueued({ id: "time-slot-test-id" }));
    assert(jetQueue.assertEnqueued({ scheduleAt: date }));
    assertEquals(jetQueue.assertEnqueued({ arg1: "nonExistentArg" }), false);
  });

  it("should clear all enqueued jobs", async () => {
    const jetQueue = new JetQueueTesting("testQueue", { instanceName: "" });
    await jetQueue.enqueue({ id: "time-slot-test-id1" });
    await jetQueue.enqueue({ id: "time-slot-test-id2" });

    assertEquals(jetQueue.getJobs(), [
      {
        id: 1,
        args: { id: "time-slot-test-id1" },
      },
      {
        id: 2,
        args: { id: "time-slot-test-id2" },
      },
    ]);

    jetQueue.clearJobs();

    assertEquals(jetQueue.getJobs().length, 0);
  });
});
