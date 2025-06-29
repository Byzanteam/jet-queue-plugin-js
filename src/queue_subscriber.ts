import type { AckMessage, JobsMessage, ListenPerform, QueueJob } from "./types";
import { appendPath } from "./utils";
import { messagesStream } from "./ws-event-generator";

export class QueueSubscriber<T extends Record<string, unknown>> {
  constructor(
    private queues: Array<{ name: string; bufferSize: number }>,
    private batchSize: number,
    private instanceName: string,
    private runtime: BreezeRuntime = BreezeRuntime,
  ) {}

  /**
   * Listen for jobs from multiple queues simultaneously.
   *
   * @param perform - An async function that handles incoming jobs
   * @returns A promise that resolves when the listener is started
   *
   * @example
   * ```typescript
   * const subscriber = new QueueSubscriber(
   *   [
   *     { name: "queue1", bufferSize: 20 },
   *     { name: "queue2", bufferSize: 15 },
   *   ],
   *   10,
   *   "testQueue",
   * );
   *
   * const perform: ListenPerform<any> = async (jobs, { ack }) => {
   *   for (const job of jobs) {
   *     console.log(job);
   *     ack({
   *       type: "ack",
   *       payload: [{ id: job.id, queue: "queue1", code: "ok" }],
   *     });
   *   }
   * };
   *
   * await subscriber.listen(perform);
   * ```
   */
  public async listen(
    perform: ListenPerform<T>,
  ): Promise<void> {
    const queues = this.queues.map((
      { name, bufferSize },
    ) => (`${name}:${bufferSize}`)).join(",");

    const socket = await this.listenSocket(queues);

    function ack(message: AckMessage) {
      socket.send(JSON.stringify(message));
    }

    for await (
      const jobs of messagesStream<QueueJob<T>>(socket, {
        timeout: 1_000,
        batchSize: this.batchSize,
        batchTimeout: 100,
        dataBuilder: (event: MessageEvent<string>) =>
          this.parseMessageData(event.data),
      })
    ) {
      await perform(jobs, { ack });
    }
  }

  private async listenSocket(queues: string): Promise<WebSocket> {
    const endpoint = await this.buildUrl("/websocket");

    endpoint.search = new URLSearchParams({
      queues,
      token: this.runtime.generateToken({
        plugin: this.instanceName,
      }),
    }).toString();

    return new WebSocket(endpoint);
  }

  private buildUrl(path: string = "/") {
    const plugin = this.runtime.getPlugin(this.instanceName);

    if (!plugin) {
      throw new Error(`plugin '${this.instanceName}' does not exist`);
    } else {
      return Promise.resolve(appendPath(plugin.endpoint, path));
    }
  }

  private parseMessageData(data: string): Array<QueueJob<T>> {
    const message: JobsMessage<T> = JSON.parse(data);
    return message.payload;
  }
}
