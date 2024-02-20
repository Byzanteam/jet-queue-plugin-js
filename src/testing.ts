import { getTestQueueInstance, setTestQueueInstance } from "./queue_state.ts";
import {
  EnqueueJobResponse,
  EnqueueOptions,
  JetQueueBase,
  JetQueueOptions,
  ListenOptions,
  ListenPerform,
  QueueJob,
  QueueJobId,
} from "./types.ts";

export class JetQueueTesting extends JetQueueBase {
  private jobs: Array<QueueJob> = [];
  private jobIdCounter: QueueJobId = 1;

  constructor(queue: string, options: JetQueueOptions) {
    super(queue, options);
  }

  enqueue<
    A extends Record<string, unknown>,
    M extends Record<string, unknown> | undefined,
  >(
    args: Readonly<A>,
    _options?: Partial<EnqueueOptions<keyof A & string, M>>,
  ): Promise<EnqueueJobResponse> {
    const jobId: QueueJobId = this.jobIdCounter++;
    this.jobs.push({ id: jobId, args });

    return Promise.resolve({
      id: jobId,
      is_conflict: false,
    });
  }

  listen(_perform: ListenPerform, _options: ListenOptions): Promise<void> {
    return Promise.resolve();
  }

  assertEnqueued(expectedArgs: Record<string, unknown>): boolean {
    return this.jobs.some((job) => {
      return Object.entries(expectedArgs).every(([key, value]) => {
        const jobValue = job.args[key];
        if (jobValue instanceof Date && value instanceof Date) {
          const isEqual = jobValue.getTime() === value.getTime();
          return isEqual;
        } else {
          const isEqual = jobValue === value;
          return isEqual;
        }
      });
    });
  }

  getJobs(): Array<QueueJob> {
    return this.jobs;
  }

  clearJobs(): void {
    this.jobs = [];
  }
}

export function setupQueueTesting() {
  const testQueueInstance = new JetQueueTesting("testQueue", {
    instanceName: "",
  });
  setTestQueueInstance(testQueueInstance);

  function clearJobs() {
    getTestQueueInstance()?.clearJobs();
  }

  function assertEnqueued(expectedArgs: Record<string, unknown>) {
    if (!getTestQueueInstance()?.assertEnqueued(expectedArgs)) {
      throw new Error("Expected job not enqueued");
    }
  }

  return { clearJobs, assertEnqueued };
}
