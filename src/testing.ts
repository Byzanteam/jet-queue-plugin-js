import {
  CancelFunction,
  EnqueueFunction,
  ListenFunction,
} from "./use-queue.ts";
import {
  EnqueueOptions,
  JetQueueOptions,
  QueueJob,
  QueueJobId,
  ReplacementOption,
  ReplacementOptions,
  UniqueOptions,
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
    // NOTE: 这里目前只能支持 args 和 meta 冲突检测
    const existingJobIndex = jobs.findIndex(([_, job, existingOptions]) =>
      isConflict(
        args,
        job.args,
        options?.unique,
        options?.meta,
        existingOptions?.meta,
      )
    );

    if (existingJobIndex !== -1 && options?.replace) {
      const updateJob = handleReplacement(
        jobs[existingJobIndex],
        args,
        options,
      );
      jobs[existingJobIndex] = updateJob;
      return Promise.resolve({
        id: updateJob[1].id,
        is_conflict: true,
      });
    }

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

function isConflict(
  args: Record<string, unknown>,
  jobArgs: Record<string, unknown>,
  unique?: Partial<UniqueOptions<string>>,
  meta?: Record<string, unknown>,
  jobMeta?: Record<string, unknown>,
): boolean {
  if (!unique?.fields || !unique?.keys) {
    return false;
  }

  if (unique.fields.includes("queue")) {
    throw new Error("Unsupported unique fields: queue is not supported");
  }

  const isEqual = (a: unknown, b: unknown) => a === b;

  return unique.keys.every((key) => {
    if (unique.fields!.includes("meta") && unique.fields!.includes("args")) {
      return isEqual(args[key], jobArgs[key]) &&
        isEqual(meta?.[key], jobMeta?.[key]);
    }

    return (unique.fields!.includes("args") &&
      isEqual(args[key], jobArgs[key])) ||
      (unique.fields!.includes("meta") &&
        isEqual(meta?.[key], jobMeta?.[key]));
  });
}

function handleReplacement(
  existingJob: [string, QueueJob<Record<string, unknown>>, maybeOptions],
  args: Record<string, unknown>,
  options: Partial<EnqueueOptions<string, Record<string, unknown>>>,
): [string, QueueJob<Record<string, unknown>>, maybeOptions] {
  if (options.replace === undefined) {
    return existingJob;
  }

  const replaceOptions = options.replace as ReplacementOptions;

  if (Object.hasOwn(replaceOptions, "all")) {
    const { replace: _, ...newOptions } = existingJob[2]!;
    existingJob[1].args = args;
    existingJob[2] = newOptions;
  } else {
    // NOTE: 测试环境目前不支持区分状态的替换
    const optionSet = new Set<ReplacementOption>();
    for (const options of Object.values(replaceOptions)) {
      if (options) {
        options.forEach((option) => optionSet.add(option));
      }
    }
    Array.from(optionSet).forEach((option) => {
      switch (option) {
        case "args":
          existingJob[1].args = args;
          break;
        case "max_attempts":
          existingJob[2]!.maxAttempts = options.maxAttempts;
          break;
        case "meta":
          existingJob[2]!.meta = options.meta;
          break;
        case "priority":
          existingJob[2]!.priority = options.priority;
          break;
        case "scheduled_at":
          existingJob[2]!.scheduledAt = options.scheduledAt;
          break;
        default:
          break;
      }
    });
  }

  return existingJob;
}
