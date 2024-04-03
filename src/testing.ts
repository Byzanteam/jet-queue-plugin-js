import {
  CancelFunction,
  EnqueueFunction,
  ListenFunction,
} from "./use-queue.ts";
import { JetQueueOptions, QueueJob, QueueJobId } from "./types.ts";

let jobs: Array<[string, QueueJob<Record<string, unknown>>]> = [];
let jobIdCounter: QueueJobId = BigInt(1);

export function makeTestingFunctions<
  T extends Record<string, unknown> = Record<string, unknown>,
>(
  queue: string,
  _options: JetQueueOptions,
) {
  const enqueue: EnqueueFunction<T> = function (
    args,
    _options,
  ): ReturnType<EnqueueFunction<T>> {
    const jobId: QueueJobId = jobIdCounter;
    jobIdCounter = jobIdCounter + BigInt(1);
    jobs.push([queue, { id: jobId, args }]);

    return Promise.resolve({
      id: jobId,
      is_conflict: false,
    });
  };

  const listen: ListenFunction<T> = function (
    _perform,
    _options,
  ): ReturnType<ListenFunction<T>> {
    return Promise.reject("Not implemented in testing");
  };

  const cancel: CancelFunction<T> = function (
    jobId: QueueJobId,
  ): ReturnType<CancelFunction<T>> {
    const index = jobs.findIndex(([_, job]) => job.id === jobId);
    if (index !== -1) {
      jobs.splice(index, 1);
    }
    return Promise.resolve();
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
): QueueJob<Record<string, unknown>> | undefined {
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
