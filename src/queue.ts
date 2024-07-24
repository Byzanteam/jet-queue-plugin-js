import type {
  AckMessage,
  EnqueueJobResponse,
  EnqueueOptions,
  JobsMessage,
  ListenOptions,
  ListenPerform,
  QueueJob,
  QueueJobId,
  QueueOptions,
} from "./types.ts";
import { messagesStream } from "./ws-event-generator.ts";

export class Queue<
  T extends Record<string, unknown> = Record<string, unknown>,
> {
  #queue: string;
  #options: QueueOptions;
  #pluginInstance: BreezeRuntime.Plugin | undefined;

  constructor(queue: string, options: QueueOptions) {
    this.#queue = queue;
    this.#options = options;
  }

  get pluginInstance(): BreezeRuntime.Plugin {
    if (!this.#pluginInstance) {
      this.#pluginInstance = BreezeRuntime.plugins[this.#options.instanceName];
    }

    return this.#pluginInstance;
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
   * const queue = new Queue("default", { instanceName: "jetQueueInstance" });
   * await queue.enqueue({ id: 1, user_id: 2 });
   * ```
   *
   * Schedule a job to run in 5 minutes:
   * ```ts
   * const queue = new Queue("default", { instanceName: "jetQueueInstance" });
   * await queue.enqueue({ id: 1 }, { scheduleIn: 5 * 60 });
   * ```
   *
   * Enqueue a job, ensuring that it is unique within the past minute:
   * ```ts
   * const queue = new Queue("default", { instanceName: "jetQueueInstance" });
   * const unique = { period: 60 };
   * await queue.enqueue({ id: 1 }, { unique: unique });
   * ```
   *
   * Enqueue a unique job where the period is compared to the `scheduled_at` timestamp rather than `inserted_at`:
   * ```ts
   * const queue = new Queue("default", { instanceName: "jetQueueInstance" });
   * await queue.enqueue({ id: 1 }, {
   *   unique: { period: 60, timestamp: "scheduled_at" },
   * });
   * ```
   *
   * Enqueue a unique job based only on the queue field, and within multiple states:
   * ```ts
   * const queue = new Queue("default", { instanceName: "jetQueueInstance" });
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
   * const queue = new Queue("default", { instanceName: "jetQueueInstance" });
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
   * const queue = new Queue("default", { instanceName: "jetQueueInstance" });
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
    let normalizedOptions: object;

    if (options) {
      normalizedOptions = convertCamelToSnakeCase(options);
    } else {
      normalizedOptions = {};
    }

    return await this.request("POST", "/jobs", {
      args,
      options: {
        queue: this.#queue,
        ...normalizedOptions,
      },
    }).then((res) => res.json());
  }

  /**
   * Cancels a job.
   *
   * @param jobId - The ID of the job to be cancelled.
   * @returns A promise that resolves when the job has been cancelled.
   *
   * @example
   *
   * Cancel a job with a specific ID:
   * ```ts
   * const queue = new Queue("default", { instanceName: "jetQueueInstance" });
   * await queue.cancel(123);
   * ```
   *
   * This method sends a DELETE request to the backend service to cancel the job with the given ID. The job ID must be a QueueJobId that uniquely identifies the job to be cancelled.
   */
  async cancel(jobId: QueueJobId): Promise<void> {
    await this.request("DELETE", `/jobs/${jobId}`);
  }

  private async request(
    method: "POST" | "DELETE",
    path: string,
    body?: object,
  ): Promise<Response> {
    const endpoint = await this.pluginInstance.getEndpoint(path);

    const response = await fetch(endpoint, {
      method,
      headers: {
        "Accept": "application/json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    if (response.ok) {
      return response;
    } else {
      const errorBody = await response.json();
      throw new Error("Request failed", {
        cause: JSON.stringify(errorBody, undefined, 2),
      });
    }
  }

  /**
   * Listen for jobs.
   *
   * @param perform - An async function that handles incoming jobs
   * @param options - The options for listening
   * @returns An async iterator of jobs
   *
   * @example
   * ```ts
   * const queue = new Queue('default');
   *
   * function perform(
   *   jobs: ReadonlyArray<QueueJob>,
   *   options: ListenPerformOptions
   * ): Promise<void> {
   *   const { ack } = options;
   *
   *   for (const job of jobs) {
   *     console.log(job);
   *
   *     ack({
   *       type: "ack",
   *       payload: [{ id: job.id, queue: "default", code: "ok" }]
   *     });
   *   }
   *
   *   return Promise.resolve();
   * }
   *
   * await queue.listen(perform, { batchSize: 10, bufferSize: 20 });
   *  ```
   */
  async listen(
    perform: ListenPerform<T>,
    options: ListenOptions,
  ): Promise<void> {
    const socket = await this.listenSocket(options);

    function ack(message: AckMessage) {
      socket.send(JSON.stringify(message));
    }

    for await (
      const jobs of messagesStream<QueueJob<T>>(
        socket,
        {
          timeout: 1_000,
          batchSize: options.batchSize,
          batchTimeout: 100,
          dataBuilder: (event: MessageEvent<string>) =>
            this.parseMessageData(event.data),
        },
      )
    ) {
      await perform(jobs, { ack });
    }
  }

  private async listenSocket(options: ListenOptions): Promise<WebSocket> {
    const { bufferSize } = options;

    const endpoint = await this.pluginInstance.getEndpoint("/websocket");

    endpoint.search = new URLSearchParams({
      queue: this.#queue,
      size: bufferSize.toString(),
    }).toString();

    return new WebSocket(endpoint);
  }

  private parseMessageData(data: string): Array<QueueJob<T>> {
    const message: JobsMessage<T> = JSON.parse(data);
    return message.payload;
  }
}

function convertCamelToSnakeCase(
  data: Record<string, unknown>,
): Record<string, unknown> {
  return Object.entries(data).reduce((acc, [key, value]) => {
    const snakeKey = key
      .replace(/([A-Z])/g, "_$1")
      .toLowerCase()
      .replace(/^_/, "");

    acc[snakeKey] = value;

    return acc;
  }, {} as Record<string, unknown>);
}
