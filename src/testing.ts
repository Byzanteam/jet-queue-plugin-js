// deno-lint-ignore-file no-explicit-any
import type { Queue } from "./queue.ts";

type Stub = any;
type ExpectedSpyCall = any;

export type QueueInternals<T extends Record<string, unknown>> = Pick<
  Queue<T>,
  "enqueue" | "cancel"
>;

let uniqueNumber: number = 0;

function generateJobId(): bigint {
  return BigInt(uniqueNumber++);
}

function defaultEnqueueStubFunc(
  queue: string,
): QueueInternals<Record<string, unknown>>["enqueue"] {
  return (args, _options) => {
    return Promise.resolve({
      id: generateJobId(),
      is_conflict: false,
      queue: queue,
      args: args,
    });
  };
}

function defaultCancelStubFunc(
  _queue: string,
): QueueInternals<Record<string, unknown>>["cancel"] {
  return async () => {};
}

export function setupQueue<
  T extends Record<string, unknown> = Record<string, unknown>,
>(
  queue: string,
  queueInternals: QueueInternals<T>,
  options: {
    beforeEach: (...args: any[]) => any;
    afterEach: (...args: any[]) => any;
    assertSpyCall: (...args: any[]) => any;
    assertSpyCalls: (...args: any[]) => any;
    stub: (...args: any[]) => any;
  },
  overwrites?: Partial<QueueInternals<T>>,
): {
  assertQueueCall: (
    functionName: keyof QueueInternals<T>,
    callIndex: number,
    expected?: ExpectedSpyCall,
  ) => void;
  assertQueueCalls: (
    functionName: keyof QueueInternals<T>,
    expectedCalls: number,
  ) => void;
  overwritesQueueInternals: (overwrites?: Partial<QueueInternals<T>>) => void;
} {
  let enqueueStub: Stub | undefined;
  let cancelStub: Stub | undefined;

  options.beforeEach(() => {
    overwritesQueueInternals(overwrites);
  });

  options.afterEach(restoreStubs);

  function restoreStubs() {
    enqueueStub?.restore();
    cancelStub?.restore();

    enqueueStub = undefined;
    cancelStub = undefined;
  }

  function getStubedFunction(
    functionName: keyof QueueInternals<T>,
  ): Stub {
    switch (functionName) {
      case "enqueue":
        return enqueueStub!;

      case "cancel":
        return cancelStub!;
    }
  }

  function assertQueueCall(
    functionName: keyof QueueInternals<T>,
    callIndex: number,
    expected?: ExpectedSpyCall,
  ) {
    options.assertSpyCall(getStubedFunction(functionName), callIndex, expected);
  }

  function assertQueueCalls(
    functionName: keyof QueueInternals<T>,
    expectedCalls: number,
  ) {
    options.assertSpyCalls(getStubedFunction(functionName), expectedCalls);
  }

  function overwritesQueueInternals(overwrites?: Partial<QueueInternals<T>>) {
    restoreStubs();

    enqueueStub = options.stub(
      queueInternals,
      "enqueue",
      overwrites?.enqueue || defaultEnqueueStubFunc(queue),
    );

    cancelStub = options.stub(
      queueInternals,
      "cancel",
      overwrites?.cancel || defaultCancelStubFunc(queue),
    );
  }

  return {
    assertQueueCall,
    assertQueueCalls,
    overwritesQueueInternals,
  };
}
