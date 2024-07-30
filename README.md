# jet-queue-plugin-js 🚀

A JS client library for interacting with the Jet Queue plugin, supporting both
plugin-based and in-memory queue mechanisms for testing and development
purposes.

## 🌟 Getting Started

### 📦 Installation

Install via [jsr](https://jsr.io):

```ts
import { Queue } from "@byzanteam/jet-queue-plugin-js";
```

## 📖 Usage Guide

### ➕ Adding Jobs to the Queue

1. **Create a queue instance:**

   ```ts
   const defaultQueue = new Queue("default", {
     instanceName: "jetQueueInstance",
   });
   ```

2. **Add a job to the queue:**

   ```ts
   await defaultQueue.enqueue(
     { id: 1, name: "Alice" },
     {
       meta: { slug: "unique-key" },
       unique: { fields: ["meta"], keys: ["slug", "id", "name"] },
     },
   );
   ```

3. **Use `replace` to update and replace:**

   ```ts
   await defaultQueue.enqueue(
     { id: updatedProject.id },
     {
       scheduledAt: new Date(),
       unique: { fields: ["args"], keys: ["id"] },
       replace: { scheduled: ["scheduled_at"] },
     },
   );
   ```

### 👂 Listening for Jobs

1. **Create a job listener:**

   ```ts
   await defaultQueue.listen(async (jobs) => {
     for (const job of jobs) {
       // Process the job
     }
   });
   ```

2. **Subscribe to multiple queues:**

   ```ts
   const subscriber = new QueueSubscriber(
     [
       { name: "queue1", bufferSize: 20 },
       { name: "queue2", bufferSize: 15 },
     ],
     10,
     "testQueue",
   );

   const perform: ListenPerform<any> = async (jobs, { ack }) => {
     for (const job of jobs) {
       console.log(job);
       ack({
         type: "ack",
         payload: [{ id: job.id, queue: "queue1", code: "ok" }],
       });
     }
   };

   await subscriber.listen(perform);
   ```

## 🧪 Testing Guide

Use `testing.ts` for test setup and assertions in BDD frameworks.

### 🔧 Internal Bindings

The `_internals` object is created to expose the internal methods and
configurations of the `default` queue instance for testing purposes. It includes
the `cancel` and `enqueue` methods, as well as the `instanceName` and `queue`:

```ts
// queue.ts
const default = new Queue<JobArgs>("default", { instanceName: "instanceName" });

export const _internals = {
  cancel: default.cancel.bind(default),
  enqueue: default.enqueue.bind(default),
  instanceName: "instanceName",
  queue: "default",
};
```

### ⚡ Quick Setup

Test setup example:

```ts
import { setupQueue } from "@byzanteam/jet-queue-plugin-js/testing";
import { afterEach, beforeEach } from "@std/testing/bdd";
import { assertSpyCall, assertSpyCalls, stub } from "@std/testing/mock";
import { _internals } from "./queue.ts";

describe("Queue Tests", () => {
  // Setup the queue with mocking internals and testing utilities
  const { assertQueueCall, assertQueueCalls, overwritesQueueInternals } =
    setupQueue(
      "default",
      _internals,
      { beforeEach, afterEach, assertSpyCall, assertSpyCalls, stub },
    );

  // Use assertQueueCall to compare if the parameters are correct
  it("should enqueue job with correct parameters", () => {
    assertQueueCall("enqueue", 0, {
      args: [
        {
          id: existingProjectId,
        },
        {
          replace: {
            scheduled: ["scheduled_at"],
          },
          scheduledAt: new Date(),
          unique: {
            //a time period in seconds during which uniqueness will be enforced, defaults to infinity
            period: 60,
            fields: ["args"],
            keys: ["id"],
          },
        },
      ],
    });
  });

  // Use assertQueueCalls to compare if the function is called the correct number of times
  it("should call enqueue function once", () => {
    assertQueueCalls("enqueue", 1);
  });

  // Use overwritesQueueInternals to reset the mocked return value of the queue functions
  it("should overwrite queue internals for enqueue", () => {
    overwritesQueueInternals({
      enqueue: (args, _options) => {
        return Promise.resolve({
          id: bindingJobId!,
          is_conflict: true,
          args,
          queue: "default",
        });
      },
    });
  });
});
```

## 📑 Types

The `enqueue` API and WebSocket return job information including `id`, `args`,
`queue`, and `is_conflict`:

```ts
export type QueueJobId = bigint;

export interface QueueJob<T extends Record<string, unknown>> {
  id: QueueJobId;
  args: Readonly<T>;
  is_conflict: boolean;
  queue: string;
}

export type EnqueueJobResponse = QueueJob<Record<string, unknown>>;
```
