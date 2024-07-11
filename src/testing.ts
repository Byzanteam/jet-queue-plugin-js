import type {
  CancelFunction,
  EnqueueFunction,
  ListenFunction,
} from "./use-queue.ts";
import type {
  EnqueueOptions,
  JetQueueOptions,
  QueueJob,
  QueueJobId,
} from "./types.ts";

type maybeOptions =
  | Partial<EnqueueOptions<string, Record<string, unknown>>>
  | undefined;
let jobs: Array<[string, QueueJob<Record<string, unknown>>, maybeOptions]> = [];
let jobIdCounter: QueueJobId = BigInt(1);

export function makeTestingFunctions<
  T extends Record<string, unknown> = Record<string, unknown>,
>(
  queue: string,
  _options: JetQueueOptions,
) {
  const enqueue: EnqueueFunction<T> = function (
    args,
    options,
  ): ReturnType<EnqueueFunction<T>> {
    const jobId: QueueJobId = jobIdCounter;
    jobIdCounter = jobIdCounter + BigInt(1);
    jobs.push([queue, { id: jobId, args }, options]);
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
  expectOptions?: maybeOptions,
): [string, QueueJob<Record<string, unknown>>, maybeOptions] | undefined {
  return jobs.find(([queue, job, options]) => {
    if (queue !== expectedQueue) return false;

    const argsMatched = matchObject(job.args, expectedArgs);

    const optionsMatched = expectOptions === undefined ||
      matchObject(options, expectOptions);

    return argsMatched && optionsMatched;
  });
}

function compareValues(a: unknown, b: unknown): boolean {
  if (a instanceof Date && b instanceof Date) {
    return a.getTime() === b.getTime();
  }
  return a === b;
}

function matchObject(
  source: Record<string, unknown> | undefined,
  target: Record<string, unknown>,
): boolean {
  return !Object.entries(target).some(([key, value]) =>
    !compareValues(source !== undefined ? source[key] : undefined, value)
  );
}
