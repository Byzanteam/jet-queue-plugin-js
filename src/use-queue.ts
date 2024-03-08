import { JetQueue } from "./queue.ts";
import { makeTestingFunctions } from "./testing.ts";
import { JetQueueOptions } from "./types.ts";

export enum JetQueueMode {
  Plugin,
  InMemory,
}

let mode: JetQueueMode = JetQueueMode.Plugin;

export function setQueueMode(newMode: JetQueueMode) {
  mode = newMode;
}

export type EnqueueFunction<T extends Record<string, unknown>> = JetQueue<
  T
>["enqueue"];
export type ListenFunction<T extends Record<string, unknown>> = JetQueue<
  T
>["listen"];
export type CancelFunction<T extends Record<string, unknown>> = JetQueue<
  T
>["cancel"];

type Functions<T extends Record<string, unknown>> = {
  enqueue: EnqueueFunction<T>;
  listen: ListenFunction<T>;
  cancel: CancelFunction<T>;
};

export function useQueue<
  T extends Record<string, unknown> = Record<string, unknown>,
>(
  queueName: string,
  options: JetQueueOptions,
): Functions<T> {
  let functions: ReturnType<typeof useQueue<T>> | undefined;

  function buildFunctions(): Functions<T> {
    if (functions) return functions;

    functions = doBuildFunctions(queueName, options);

    return functions;
  }

  return {
    enqueue: proxyFunction(buildFunctions, "enqueue"),
    listen: proxyFunction(buildFunctions, "listen"),
    cancel: proxyFunction(buildFunctions, "cancel"),
  };
}

function doBuildFunctions<
  T extends Record<string, unknown> = Record<string, unknown>,
>(
  queueName: Parameters<typeof useQueue<T>>[0],
  options: Parameters<typeof useQueue<T>>[1],
): Functions<T> {
  switch (mode) {
    case JetQueueMode.Plugin: {
      const queue = new JetQueue<T>(queueName, options);

      return {
        enqueue: queue.enqueue.bind(queue),
        listen: queue.listen.bind(queue),
        cancel: queue.cancel.bind(queue),
      };
    }

    case JetQueueMode.InMemory: {
      return makeTestingFunctions(queueName, options);
    }

    default:
      throw "Never reach here";
  }
}

function proxyFunction<
  A extends Record<string, unknown>,
  T extends Functions<A>,
  U extends keyof Functions<A>,
>(
  builder: () => T,
  functionName: U,
) {
  return function (...args: Parameters<T[U]>): ReturnType<T[U]> {
    const functions = builder();

    const fn = functions[functionName] as (
      ...args: Parameters<T[U]>
    ) => ReturnType<T[U]>;

    return fn(...args);
  };
}
