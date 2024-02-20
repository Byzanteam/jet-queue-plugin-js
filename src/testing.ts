// deno-lint-ignore-file
import {
  AckMessage,
  EnqueueJobResponse,
  EnqueueOptions,
  JetQueueBase,
  JetQueueOptions,
  ListenOptions,
  ListenPerform,
  QueueJob,
  QueueJobId,
} from "./types.ts";

export class JetQueueTest extends JetQueueBase {
  private jobs: Array<QueueJob> = [];
  private jobIdCounter: QueueJobId = 1;
  private eventTarget: EventTarget = new EventTarget();
  private listening: boolean = false;

  constructor(queue: string, options: JetQueueOptions) {
    super(queue, options);
  }

  async enqueue<
    A extends Record<string, unknown>,
    M extends Record<string, unknown> | undefined,
  >(
    args: Readonly<A>,
    _options?: Partial<EnqueueOptions<keyof A & string, M>>,
  ): Promise<EnqueueJobResponse> {
    const jobId: QueueJobId = this.jobIdCounter++;
    const newJob: QueueJob = { id: jobId, args };
    this.jobs.push(newJob);

    const event = new CustomEvent("jobEnqueued", { detail: newJob });
    this.eventTarget.dispatchEvent(event);

    return {
      id: jobId,
      is_conflict: false,
    };
  }

  async listen(perform: ListenPerform, _options: ListenOptions): Promise<void> {
    this.listening = true;

    const listener = async (event: Event) => {
      if (!(event instanceof CustomEvent)) return;
      const jobDetail: QueueJob = event.detail;

      const jobIndex = this.jobs.findIndex((job) => job.id === jobDetail.id);
      if (jobIndex !== -1) {
        const [jobToProcess] = this.jobs.splice(jobIndex, 1);

        await perform([jobToProcess], {
          ack: (message: AckMessage) => {
            console.log(`Acknowledged: ${JSON.stringify(message)}`);
          },
        });
      }
    };

    this.eventTarget.addEventListener("jobEnqueued", listener);

    return new Promise((resolve) => {
      this.stopListening = () => {
        this.eventTarget.removeEventListener("jobEnqueued", listener);
        this.listening = false;
        resolve();
      };
    });
  }

  stopListening: () => void = () => {
    console.warn("Listen not started or already stopped.");
  };

  getJobs(): Array<QueueJob> {
    return this.jobs;
  }
}
