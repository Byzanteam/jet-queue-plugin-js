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
