import { JetQueue } from "./queue.ts";
import { makeTestingFunctions } from "./testing.ts";
import { JetQueueOptions } from "./types.ts";

export enum JetQueueMode {
  Plugin,
  InMemory,
}

let mode: JetQueueMode = JetQueueMode.Plugin;

export function setMode(newMode: JetQueueMode) {
  mode = newMode;
}

export type EnqueueFunction = JetQueue["enqueue"];
export type ListenFunction = JetQueue["listen"];

type Functions = {
  enqueue: EnqueueFunction;
  listen: ListenFunction;
};

export function useQueue(
  queueName: string,
  options: JetQueueOptions,
): Functions {
  let functions: ReturnType<typeof useQueue> | undefined;

  function buildFunctions(): Functions {
    if (functions) return functions;

    functions = doBuildFunctions(queueName, options);

    return functions;
  }

  return {
    enqueue: proxyFunction(buildFunctions, "enqueue"),
    listen: proxyFunction(buildFunctions, "listen"),
  };
}

const doBuildFunctions: typeof useQueue = function (
  queueName,
  options,
): Functions {
  switch (mode) {
    case JetQueueMode.Plugin: {
      const queue = new JetQueue(queueName, options);

      return {
        enqueue: queue.enqueue,
        listen: queue.listen,
      };
    }

    case JetQueueMode.InMemory: {
      return makeTestingFunctions(queueName, options);
    }

    default:
      throw "Never reach here";
  }
};

function proxyFunction<T extends Functions, U extends keyof Functions>(
  builder: () => T,
  functionName: U,
) {
  return function (...args: Parameters<T[U]>): ReturnType<T[U]> {
    const functions = builder();

    const fn = functions[functionName] as (
      ...args: Parameters<T[U]>
    ) => ReturnType<T[U]>;

    return fn.apply(null, args);
  };
}
