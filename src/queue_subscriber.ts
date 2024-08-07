import type {
  AckMessage,
  JobsMessage,
  ListenPerform,
  QueueJob,
} from "./types.ts";
import { messagesStream } from "./ws-event-generator.ts";

export class QueueSubscriber<T extends Record<string, unknown>> {
  private pluginInstance: BreezeRuntime.Plugin;

  constructor(
    private queues: Array<{ name: string; bufferSize: number }>,
    private batchSize: number,
    instanceName: string,
  ) {
    const pluginInstance = BreezeRuntime.plugins[instanceName];

    if (!pluginInstance) {
      throw new Error(`Plugin ${instanceName} not found`);
    }

    this.pluginInstance = pluginInstance;
  }

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
    const endpoint = await this.pluginInstance.getEndpoint("/websocket");

    endpoint.search = new URLSearchParams({ queues }).toString();

    return new WebSocket(endpoint);
  }

  private parseMessageData(data: string): Array<QueueJob<T>> {
    const message: JobsMessage<T> = JSON.parse(data);
    return message.payload;
  }
}
