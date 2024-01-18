type EnumToConst<T extends string> = `${T}`;

export type QueueJobId = number;

export interface EnqueueJobResponse {
  id: QueueJobId;
  is_conflict: boolean;
}

export interface QueueJob {
  id: QueueJobId;
  args: Readonly<Record<string, unknown>>;
}

interface UniqueOptions<T extends string> {
  /** a list of fields to use for uniqueness calculations */
  fields: ReadonlyArray<"args" | "meta" | "queue">;
  /** a list of arg or meta keys to use for uniqueness calculations */
  keys: ReadonlyArray<T>;
  /** a time period in seconds during which uniqueness will be enforced */
  period: number;
  /** a list of states during which uniqueness will be enforced */
  states: ReadonlyArray<EnumToConst<JobState>>;
  /** the name of the timestamp field to use for period calculations */
  timestamp: "inserted_at" | "scheduled_at";
}

/**
 * Options for enqueuing jobs.
 * See detail at {@link https://hexdocs.pm/oban/Oban.Job.html#new/2}
 */
export interface EnqueueOptions<
  AK extends string,
  M extends Record<string, unknown> | undefined,
> {
  /** a named queue to push the job into.
   * Jobs may be pushed into any queue,
   * regardless of whether jobs are currently being processed for the queue. */
  queue: string;

  /** the maximum number of times a job can be retried
   * if there are errors during execution */
  maxAttempts: number;

  /** a map containing additional information about the job */
  meta?: Readonly<Record<keyof M, unknown>>;

  /** a numerical indicator from 0 to 9 of how important this job is
   * relative to other jobs in the same queue.
   * The lower the number, the higher priority the job. */
  priority: number;

  /** a time in the future after which the job should be executed */
  scheduledAt: Date;
  /** the number of seconds until the job should be executed */
  scheduleIn: number;

  /** a keyword list of options specifying how uniqueness will be calculated.
   * The options define which fields will be used,
   * for how long, with which keys, and for which states. */
  unique: Partial<
    UniqueOptions<AK | (keyof M & string)>
  >;
}

/**
 * A canonical list of all possible job states.
 *
 * This may be used to build up `unique` options without duplicating states in application code.
 *
 * ## Job State Transitions
 *
 * - `scheduled`—Jobs inserted with `scheduledAt` in the future are `scheduled`. After the
 *   `scheduledAt` time has elapsed the `Oban.Plugins.Stager` will transition them to `available`
 *
 * - `available`—Jobs without a future `scheduledAt` timestamp are inserted as `available` and may
 *   execute immediately
 *
 * - `executing`—Available jobs may be ran, at which point they are `executing`
 *
 * - `retryable`—Jobs that fail and haven't exceeded their max attempts are transitioned to
 *   `retryable` and rescheduled until after a backoff period. Once the backoff has elapsed the
 *   `Oban.Plugins.Stager` will transition them back to `available`
 *
 * - `completed`—Jobs that finish executing successfully are marked `completed`
 *
 * - `discarded`—Jobs that fail and exhaust their max attempts, or return a `discard` tuple during
 *   execution, are marked `discarded`
 *
 * - `cancelled`—Jobs that are cancelled intentionally
 */
export enum JobState {
  Scheduled = "scheduled",
  Available = "available",
  Executing = "executing",
  Retryable = "retryable",
  Completed = "completed",
  Discarded = "discarded",
  Cancelled = "cancelled",
}
