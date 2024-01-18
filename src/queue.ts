import {
  EnqueueJobResponse,
  EnqueueOptions,
  QueueJob,
  QueueJobId,
} from "./types.ts";

export interface JetQueueOptions {
  instanceName: string;
}

export class JetQueue {
  private pluginInstance: BreezeRuntime.Plugin;

  constructor(private queue: string, options: JetQueueOptions) {
    const pluginInstance = BreezeRuntime.plugins[options.instanceName];

    if (!pluginInstance) {
      throw new Error(`Plugin ${options.instanceName} not found`);
    }

    this.pluginInstance = pluginInstance;
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
   * const queue = new JetQueue("default", { instanceName: "jetQueueInstance" });
   * await queue.enqueue({ id: 1, user_id: 2 });
   * ```
   *
   * Enqueue a job with the `specified` queue other than `default`:
   * ```ts
   * const queue = new JetQueue("default", { instanceName: "jetQueueInstance" });
   * await queue.enqueue({ id: 1, user_id: 2 }, { queue: "specified" });
   * ```
   *
   * Schedule a job to run in 5 minutes:
   * ```ts
   * const queue = new JetQueue("default", { instanceName: "jetQueueInstance" });
   * await queue.enqueue({ id: 1 }, { scheduleIn: 5 * 60 });
   * ```
   *
   * Enqueue a job, ensuring that it is unique within the past minute:
   * ```ts
   * const queue = new JetQueue("default", { instanceName: "jetQueueInstance" });
   * const unique = { period: 60 };
   * await queue.enqueue({ id: 1 }, { unique: unique });
   * ```
   *
   * Enqueue a unique job where the period is compared to the `scheduled_at` timestamp rather than `inserted_at`:
   * ```ts
   * const queue = new JetQueue("default", { instanceName: "jetQueueInstance" });
   * await queue.enqueue({ id: 1 }, {
   *   unique: { period: 60, timestamp: "scheduled_at" },
   * });
   * ```
   *
   * Enqueue a unique job based only on the queue field, and within multiple states:
   * ```ts
   * const queue = new JetQueue("default", { instanceName: "jetQueueInstance" });
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
   * const queue = new JetQueue("default", { instanceName: "jetQueueInstance" });
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
   * const queue = new JetQueue("default", { instanceName: "jetQueueInstance" });
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
  ): Promise<EnqueueJobResponse> {
    const { queue = this.queue, ...opts } = options ?? {};

    return await this.post<EnqueueJobResponse>("/jobs", {
      args,
      options: {
        queue,
        ...opts,
      },
    });
  }

  /**
   * Listen for jobs.
   *
   * @returns An async iterator of jobs
   *
   * @example
   * ```ts
   * const queue = new JetQueue('default');
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

  private async post<T>(path: string, body: object): Promise<T> {
    const endpoint = await this.pluginInstance.getEndpoint(`/api${path}`);

    const response = await fetch(endpoint, {
      method: "POST",
      body: JSON.stringify(body),
    });

    if (response.ok) {
      return response.json();
    } else {
      const errorBody = await response.json();
      throw new Error("Request failed", { cause: errorBody });
    }
  }
}
