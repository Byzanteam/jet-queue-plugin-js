import {
  CancelFunction,
  EnqueueFunction,
  ListenFunction,
} from "./use-queue.ts"; // 更新导入以包括CancelFunction
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

  const cancel: CancelFunction = function (
    jobId: QueueJobId,
  ): ReturnType<CancelFunction> {
    const index = jobs.findIndex(([_, job]) => job.id === jobId);
    if (index !== -1) {
      jobs.splice(index, 1);
      return Promise.resolve();
    }
    return Promise.reject(new Error("Job not found"));
  };

  return {
    enqueue,
    listen,
    cancel,
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
