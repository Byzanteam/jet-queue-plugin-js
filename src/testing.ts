import {
  EnqueueFunction,
  JetQueueMode,
  ListenFunction,
  setMode,
} from "./use-queue.ts";
import { JetQueueOptions, QueueJob, QueueJobId } from "./types.ts";

let jobs: Array<[string, QueueJob]> = [];
let jobIdCounter: QueueJobId = 1;

export function makeTestingFunctions(
  queue: string,
  _options: JetQueueOptions,
) {
  const enqueue: EnqueueFunction = function (
    args,
    _options,
  ): ReturnType<EnqueueFunction> {
    const jobId: QueueJobId = jobIdCounter++;
    jobs.push([queue, { id: jobId, args }]);

    return Promise.resolve({
      id: jobId,
      is_conflict: false,
    });
  };

  const listen: ListenFunction = function (
    _perform,
    _options,
  ): ReturnType<ListenFunction> {
    return Promise.reject("Not implemented in testing");
  };

  return {
    enqueue,
    listen,
  };
}

export function clearJobs() {
  jobs = [];
}

export function getJobs() {
  return jobs;
}

export function findEnqueuedJob(
  expectedQueue: string,
  expectedArgs: Record<string, unknown>,
): QueueJob | undefined {
  return jobs.find(([queue, job]) => {
    if (queue !== expectedQueue) return false;

    return Object.entries(expectedArgs).every(([key, value]) => {
      const argValue = job.args[key];

      if (argValue instanceof Date && value instanceof Date) {
        return argValue.getTime() === value.getTime();
      } else {
        return argValue === value;
      }
    });
  })?.[1];
}

export { type JetQueueMode, setMode };
