import { afterAll, afterEach, assert, beforeAll } from "./dev_deps.ts";
import { clearJobs, findEnqueuedJob, getJobs } from "./src/testing.ts";
import { JetQueueMode, setQueueMode } from "./src/use-queue.ts";

export { clearJobs, findEnqueuedJob, getJobs, JetQueueMode, setQueueMode };

export function setupQueue() {
  beforeAll(() => {
    setQueueMode(JetQueueMode.InMemory);
  });

  afterAll(() => {
    setQueueMode(JetQueueMode.Plugin);
  });

  afterEach(clearJobs);

  function assertEnqueuedJob(
    queue: string,
    expectedArgs: Record<string, unknown>,
  ) {
    assert(
      findEnqueuedJob(queue, expectedArgs),
      `Expected job not enqueued, queue: ${JSON.stringify(queue)}, args: ${
        JSON.stringify(expectedArgs)
      }`,
    );
  }

  return { assertEnqueuedJob };
}
