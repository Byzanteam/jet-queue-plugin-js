export interface MessagesStreamOptions<T> {
  timeout: number;
  batchSize: number;
  batchTimeout: number;
  dataBuilder: (event: MessageEvent<string>) => Array<T>;
}

export async function* messagesStream<T>(
  socket: WebSocket,
  options: MessagesStreamOptions<T>,
): AsyncIterable<Array<T>> {
  const { timeout, batchSize, batchTimeout, dataBuilder } = options;

  const buffer: Array<T> = [];

  let pong = true;

  let beginResolver: (() => void) | undefined = undefined;
  let commitResolver: (() => void) | undefined = undefined;

  // The stream stops once the socket can no longer deliver jobs. `failure`
  // distinguishes the two cases:
  //   - set    -> abnormal (ping timeout, error, unclean close). The generator
  //               re-throws it so the rejection propagates through `for await`
  //               up to the top-level `await listen(...)`, crashing the process
  //               so the runtime restarts with a fresh connection.
  //   - unset  -> clean shutdown. The generator returns and the consumer
  //               finishes normally.
  // Stopping from a timer/event callback only flips this flag and wakes the
  // generator; the actual throw/return happens in the generator's own
  // execution. A bare `throw` inside a callback would not reach the `for await`
  // chain and would leave a zombie connection: socket open, server dispatching,
  // no jobs acked.
  let stopped = false;
  let failure: Error | undefined = undefined;
  let pingTimeoutId: ReturnType<typeof setTimeout> | undefined = undefined;

  function stop(error?: Error) {
    if (stopped) return;
    stopped = true;
    failure = error;

    clearTimeout(pingTimeoutId);
    if (error) socket.close();

    // Wake whichever phase the generator is parked on so it observes `stopped`.
    beginResolver?.();
    commitResolver?.();
  }

  function pushEvent(event: MessageEvent<string>) {
    beginResolver?.();

    buffer.push(...dataBuilder(event));

    if (commitResolver && buffer.length >= batchSize) {
      commitResolver();
    }
  }

  socket.addEventListener("open", () => {
    (function ping() {
      if (stopped) return;

      if (pong) {
        pong = false;
        socket.send("ping");
        pingTimeoutId = setTimeout(ping, timeout);
      } else {
        stop(new Error("Ping timeout"));
      }
    })();
  });

  socket.addEventListener("message", (event: MessageEvent<string>) => {
    if ("pong" === event.data) {
      pong = true;
    } else {
      pushEvent(event);
    }
  });

  socket.addEventListener("error", () => {
    stop(new Error("WebSocket error"));
  });

  socket.addEventListener("close", (event: CloseEvent) => {
    // 1000 (normal) and 1001 (going away) are graceful shutdowns: stop without
    // an error so the consumer finishes. Any other code is abnormal and stops
    // with an error so the process crashes and the runtime reconnects.
    const clean = event.wasClean || event.code === 1000 ||
      event.code === 1001;

    stop(
      clean ? undefined : new Error(`WebSocket closed (code ${event.code})`),
    );
  });

  // Throws on abnormal stop, signals the caller to `return` on clean stop.
  function shouldStop(): boolean {
    if (failure) throw failure;
    return stopped;
  }

  while (true) {
    if (shouldStop()) return;

    const commit = new Promise<void>((resolve) => {
      commitResolver = resolve;
    });

    // Only park for the first event of a batch. If a previous batch left a
    // remainder, skip the wait and flush it instead of blocking until the next
    // message arrives.
    if (0 === buffer.length) {
      await new Promise<void>((resolve) => {
        beginResolver = resolve;
      });

      beginResolver = undefined;

      if (shouldStop()) return;
    }

    let batchTimeoutId: ReturnType<typeof setTimeout> | undefined = undefined;

    await Promise.race([
      new Promise<void>((resolve) => {
        batchTimeoutId = setTimeout(resolve, batchTimeout);
      }),
      commit,
    ]);

    clearTimeout(batchTimeoutId);

    commitResolver = undefined;

    if (shouldStop()) return;

    if (0 !== buffer.length) {
      yield buffer.splice(0, Math.min(buffer.length, batchSize));
    }
  }
}
