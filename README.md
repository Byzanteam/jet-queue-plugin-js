# jet-queue-plugin-js

JS Client library to interact with Jet queue plugin, supporting both
plugin-based and in-memory queue mechanisms for testing and development
purposes.

## Usage

**Installation**

Install it via [jsdelivr](https://www.jsdelivr.com/).

```ts
import { useQueue } from "https://cdn.jsdelivr.net/gh/Byzanteam/jet-queue-plugin-js/mod.ts";
```

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

## Testing Setup with `testing.ts`

Use `testing.ts` for easy testing setup and assertions in BDD frameworks:

### Quick Setup

```ts
import { setupQueue } from "https://cdn.jsdelivr.net/gh/Byzanteam/jet-queue-plugin-js/testing.ts";

describe("Queue Tests", () => {
  const { assertEnqueuedJob } = setupQueue();

  it("enqueues job correctly", () => {
    // Enqueue job
    assertEnqueuedJob("testQueue", { id: 1, name: "Test" });
  });
});
```
