import { EnqueueOptions, QueueJob, QueueJobId } from "./types.ts";

export class JetQueue {
  constructor(private queue: string, private size: number) {
    // TODO: implement
    console.log("constructor", this.queue, this.size);
  }

  /**
   * Enqueue a job.
   *
   * @param args - The arguments for the job
   * @param options - The options for the job
   * @returns The new job's id
   *
   * @example
   *
   * Enqueue a job with the `default` queue:
   * ```ts
   * const queue = new JetQueue('default', 10);
   * await queue.enqueue({ id: 1, user_id: 2 });
   * ```
   *
   * Enqueue a job with the `specified` queue other than `default`:
   * ```ts
   * const queue = new JetQueue("default", 10);
   * await queue.enqueue({ id: 1, user_id: 2 }, { queue: "specified" });
   * ```
   *
   * Schedule a job to run in 5 minutes:
   * ```ts
   * const queue = new JetQueue("default", 10);
   * await queue.enqueue({ id: 1 }, { scheduleIn: 5 * 60 });
   * ```
   *
   * Enqueue a job, ensuring that it is unique within the past minute:
   * ```ts
   * const queue = new JetQueue("default", 10);
   * const unique = { period: 60 };
   * await queue.enqueue({ id: 1 }, { unique: unique });
   * ```
   *
   * Enqueue a unique job where the period is compared to the `scheduled_at` timestamp rather than `inserted_at`:
   * ```ts
   * const queue = new JetQueue("default", 10);
   * await queue.enqueue({ id: 1 }, {
   *   unique: { period: 60, timestamp: "scheduled_at" },
   * });
   * ```
   *
   * Enqueue a unique job based only on the queue field, and within multiple states:
   * ```ts
   * const queue = new JetQueue("default", 10);
   * await queue.enqueue({ id: 1 }, {
   *   unique: {
   *     period: 60,
   *     fields: ["queue"],
   *     states: [
   *       "available",
   *       "scheduled",
   *       "executing",
   *       "retryable",
   *       "completed",
   *     ],
   *   },
   * });
   * ```
   *
   * Enqueue a unique job considering only the queue and specified keys in the args:
   * ```ts
   * const queue = new JetQueue("default", 10);
   * await queue.enqueue({ account_id: 1, url: "https://example.com" }, {
   *   unique: {
   *     fields: ["args", "queue"],
   *     keys: ["account_id", "url"],
   *   },
   * });
   * ```
   *
   * Enqueue a unique job considering only specified keys in the meta:
   * ```ts
   * const queue = new JetQueue("default", 10);
   * await queue.enqueue({ id: 1, name: "Alice" }, {
   *   meta: { slug: "unique-key" },
   *   unique: { fields: ["meta"], keys: ["slug", "id", "name"] },
   * });
   * ```
   */
  async enqueue<
    A extends Record<string, unknown>,
    M extends Record<string, unknown> | undefined,
  >(
    args: Readonly<A>,
    options?: Partial<EnqueueOptions<keyof A & string, M>>,
  ): Promise<QueueJobId> {
    // TODO: implement
    const { queue = this.queue, ...opts } = options ?? {};
    console.log("enqueue", queue, args, opts);
    return await Promise.resolve(1);
  }

  /**
   * Listen for jobs.
   *
   * @returns An async iterator of jobs
   *
   * @example
   * ```ts
   * const queue = new JetQueue('default', 10);
   * for await (const job of queue.listen()) {
   *   console.log(job);
   * }
   *  ```
   */
  async *listen(): AsyncGenerator<QueueJob> {
    // TODO: implement
    yield await Promise.resolve({
      id: 1,
      args: {},
    });
  }
}
