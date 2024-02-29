# jet-queue-plugin-js

JS Client library to interact with Jet queue plugin, supporting both
plugin-based and in-memory queue mechanisms for testing and development
purposes.

## Installation

Install it via [jsdelivr](https://www.jsdelivr.com/).

```ts
import {
  JetQueueMode,
  setMode,
  useQueue,
} from "<https://cdn.jsdelivr.net/gh/Byzanteam/jet-queue-plugin-js/mod.ts>";
```

**Usage**

Before interacting with the queue, you can set the mode depending on your
environment (Plugin or InMemory for testing).

```ts
// Set to InMemory mode for testing
setMode(JetQueueMode.InMemory);

// Or set to Plugin mode for production
setMode(JetQueueMode.Plugin);
```

Then, use the **`useQueue`** function to interact with the queue. This allows
you to enqueue jobs and listen for jobs to process in a more flexible way,
depending on the mode set.

### **Enqueuing a Job**

```ts
const { enqueue } = useQueue("default", { instanceName: "jetQueueInstance" });

// enqueue a job
await enqueue({ id: 1, name: "Alice" }, {
  meta: { slug: "unique-key" },
  unique: { fields: ["meta"], keys: ["slug", "id", "name"] },
});
```

### **Listening for Jobs**

```ts
const { listen } = useQueue("default", { instanceName: "jetQueueInstance" });

await listen(async (jobs) => {
  for (const job of jobs) {
    // handle job
  }
});
```

## Testing Utilities

When using `JetQueueMode.InMemory` for testing, the library provides utility
functions to help simulate queue operations without a real backend. These
functions allow you to enqueue jobs, retrieve enqueued jobs, clear the job list
for isolated tests, and find specific jobs based on criteria.

### Enqueuing, Retrieving, and Finding Specific Jobs

To enqueue a job, retrieve it, and assert specific job characteristics in your
tests:

```ts
import {
  clearJobs,
  findEnqueuedJob,
  getJobs,
  JetQueueMode,
  setMode,
  useQueue,
} from "xxx/mod.ts";

// Set the mode to InMemory for testing
setMode(JetQueueMode.InMemory);

// Use the testing queue
const { enqueue } = useQueue("testQueue", {});

// Enqueue a job
await enqueue({ id: 1, name: "Test" });

// Retrieve all enqueued jobs
const jobs = getJobs();

// Assert the enqueued job is as expected
console.assert(jobs.length === 1, "Expected exactly one job to be enqueued");

// Find a specific job by its expected queue and arguments
const expectedQueue = "testQueue";
const expectedArgs = { id: 1, name: "Test" };
const job = findEnqueuedJob(expectedQueue, expectedArgs);

// Assert the found job
console.assert(
  job !== undefined,
  "Expected to find the job with specified args",
);
console.assert(
  job.args.id === expectedArgs.id && job.args.name === expectedArgs.name,
  "Job's args should match the expected args",
);

// Clear all enqueued jobs for isolated tests
clearJobs();
```
