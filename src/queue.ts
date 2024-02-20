import {
  AckMessage,
  EnqueueJobResponse,
  EnqueueOptions,
  JetQueueBase,
  JetQueueOptions,
  JobsMessage,
  ListenOptions,
  ListenPerform,
  QueueJob,
} from "./types.ts";
import { listen } from "./ws-event-generator.ts";

export class JetQueue extends JetQueueBase {
  private pluginInstance: BreezeRuntime.Plugin;

  constructor(queue: string, options: JetQueueOptions) {
    super(queue, options);
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
      const jobs of chunk(
        this.listenQueueJobs(socket),
        options.batchSize,
        100,
      )
    ) {
      await perform(jobs, { ack });
    }
  }

  private async listenSocket(options: ListenOptions): Promise<WebSocket> {
    const { bufferSize } = options;

    const endpoint = await this.pluginInstance.getEndpoint();

    endpoint.search = new URLSearchParams({
      queue: this.queue,
      size: bufferSize.toString(),
    }).toString();

    switch (endpoint.protocol) {
      case "http":
        endpoint.protocol = "ws";
        break;

      case "https":
        endpoint.protocol = "wss";
        break;

      default:
        break;
    }

    const socket = new WebSocket(endpoint);

    return socket;
  }

  private async *listenQueueJobs(socket: WebSocket): AsyncIterable<QueueJob> {
    let pong = true;

    (function ping() {
      if (pong) {
        pong = false;
        socket.send("ping");
        setTimeout(ping, 1_000);
      } else {
        throw new Error("Ping timeout");
      }
    })();

    for await (const { data } of listen<string>(socket)) {
      const message = this.parseMessageData(data);

      if ("pong" === message) {
        pong = true;
      } else {
        yield* message.payload;
      }
    }
  }

  private parseMessageData(data: string): "pong" | JobsMessage {
    if ("pong" === data) {
      return data;
    } else {
      return JSON.parse(data);
    }
  }
}

async function* chunk<T>(
  iterable: AsyncIterable<T>,
  size: number,
  timeout: number,
): AsyncIterable<Array<T>> {
  const iterator = iterable[Symbol.asyncIterator]();
  const buffer: Array<T> = [];

  async function takeSize(): Promise<Array<T>> {
    while (buffer.length < size) {
      const result = await Promise.race([
        new Promise<void>((resolve) => setTimeout(resolve, timeout)),
        iterator.next().then((elem) => {
          buffer.push(elem.value);
          return elem;
        }),
      ]);

      // 超时了
      if (!result) break;

      if (buffer.length === size) {
        break;
      }
    }

    return transfer<T>(buffer, Math.min(buffer.length, size));
  }

  function transfer<K>(arr: Array<K>, size: number): Array<K> {
    const result: Array<K> = [];

    for (let i = 0; i < size; i++) {
      result.push(arr.shift()!);
    }

    return result;
  }

  while (true) {
    yield takeSize();
  }
}
