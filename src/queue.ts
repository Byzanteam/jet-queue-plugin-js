import {
  AckMessage,
  EnqueueJobResponse,
  EnqueueOptions,
  JetQueueOptions,
  JobsMessage,
  ListenOptions,
  ListenPerform,
  QueueJob,
} from "./types.ts";
import { listen } from "./ws-event-generator.ts";

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
    return await this.post<EnqueueJobResponse>("/jobs", {
      args,
      options: {
        queue: this.queue,
        ...options,
      },
    });
  }

  private async post<T>(path: string, body: object): Promise<T> {
    const endpoint = await this.pluginInstance.getEndpoint(path);

    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Accept": "application/json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    if (response.ok) {
      return response.json();
    } else {
      const errorBody = await response.json();
      throw new Error("Request failed", { cause: errorBody });
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
   * const queue = new JetQueue('default');
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
   *       payload: [{ id: job.id, code: "ok" }]
   *     });
   *   }
   *
   *   return Promise.resolve();
   * }
   *
   * await queue.listen(perform, { batchSize: 10, bufferSize: 20 });
   *  ```
   */
  async listen(perform: ListenPerform, options: ListenOptions): Promise<void> {
    const socket = await this.listenSocket(options);

    function ack(message: AckMessage) {
      socket.send(JSON.stringify(message));
    }

    for await (
      const jobs of listen<string, QueueJob>(
        socket,
        options.batchSize,
        100,
        (event: MessageEvent<string>) => this.parseMessageData(event.data),
      )
    ) {
      await perform(jobs, { ack });
    }
  }

  private async listenSocket(options: ListenOptions): Promise<WebSocket> {
    const { bufferSize } = options;

    const endpoint = await this.pluginInstance.getEndpoint("/websocket");

    endpoint.search = new URLSearchParams({
      queue: this.queue,
      size: bufferSize.toString(),
    }).toString();

    const socket = new WebSocket(endpoint);

    let pong = true;

    socket.addEventListener("open", () => {
      (function ping() {
        if (pong) {
          pong = false;
          socket.send("ping");
          setTimeout(ping, 1_000);
        } else {
          throw new Error("Ping timeout");
        }
      })();
    });

    socket.addEventListener("message", (event: MessageEvent<string>) => {
      if ("pong" === event.data) {
        pong = true;
      }
    });

    return socket;
  }

  private parseMessageData(data: string): Array<QueueJob> {
    if ("pong" === data) {
      return [];
    } else {
      const message: JobsMessage = JSON.parse(data);
      return message.payload;
    }
  }
}
