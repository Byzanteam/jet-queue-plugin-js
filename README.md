# jet-queue-plugin-js

JS Client library to interact with Jet queue plugin.

## Usage

Install it via [jsdelivr](https://www.jsdelivr.com).

```ts
import { JetQueue } from "https://cdn.jsdelivr.net/gh/Byzanteam/jet-queue-plugin-js/mod.ts";
```

Then you're able to interact with the queue.

```ts
const queue = new JetQueue("default");

// enqueue a job
await queue.enqueue({ id: 1, name: "Alice" }, {
  meta: { slug: "unique-key" },
  unique: { fields: ["meta"], keys: ["slug", "id", "name"] },
});
```

Listening for jobs to process.

```ts
const queue = new JetQueue("default");

for await (const job of queue.listen()) {
  // handle job
}
```

## JetQueueTesting

- Mock Enqueuing: Enables the simulation of job enqueuing in tests.
- Task Verification: Offers assertion capabilities to check if specific tasks
  have been enqueued.
- Task Management: Supports retrieval and clearance of all tasks in the mock
  queue.

Usage Example

```ts
import { JetQueueTesting } from "./testing.ts";
import { assert } from "https://deno.land/std/assert/mod.ts";

// Create a JetQueueTesting instance
const jetQueue = new JetQueueTesting("testQueue");

// Mock a job enqueuing
const jobArgs = { id: "sample-job-id", data: "sample data" };
await jetQueue.enqueue(jobArgs);

// Assert the job was enqueued
assert(jetQueue.assertEnqueued(jobArgs));

// Clear all mocked jobs
jetQueue.clearJobs();
```
