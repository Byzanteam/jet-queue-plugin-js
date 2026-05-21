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

  // Set on any unrecoverable socket condition. The generator re-throws it from
  // its own execution so the rejection propagates through the `for await`
  // consumer up to the top-level `await listen(...)`, crashing the process so
  // the runtime restarts it with a fresh connection. A bare `throw` inside a
  // timer/event callback would not reach that chain and would instead leave a
  // zombie connection: the socket stays open, the server keeps dispatching,
  // but no jobs are ever acked.
  let failure: Error | undefined = undefined;
  let pingTimeoutId: ReturnType<typeof setTimeout> | undefined = undefined;

  function fail(error: Error) {
    if (failure) return;
    failure = error;

    clearTimeout(pingTimeoutId);
    socket.close();

    // Wake whichever phase the generator is currently parked on so it can
    // observe `failure` and throw immediately.
    beginResolver?.();
    commitResolver?.();
  }

  function pushEvent(event: MessageEvent<string>) {
    if (beginResolver) {
      beginResolver();
    }

    buffer.push(...dataBuilder(event));

    if (commitResolver && buffer.length >= batchSize) {
      commitResolver();
    }
  }

  socket.addEventListener("open", () => {
    (function ping() {
      if (failure) return;

      if (pong) {
        pong = false;
        socket.send("ping");
        pingTimeoutId = setTimeout(ping, timeout);
      } else {
        fail(new Error("Ping timeout"));
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
    fail(new Error("WebSocket error"));
  });

  socket.addEventListener("close", () => {
    fail(new Error("WebSocket closed"));
  });

  while (true) {
    if (failure) throw failure;

    const commit = new Promise<void>((resolve) => {
      commitResolver = resolve;
    });

    await new Promise<void>((resolve) => {
      beginResolver = resolve;
    });

    beginResolver = undefined;

    if (failure) throw failure;

    let batchTimeoutId: ReturnType<typeof setTimeout> | undefined = undefined;

    await Promise.race([
      new Promise<void>((resolve) => {
        batchTimeoutId = setTimeout(resolve, batchTimeout);
      }),
      commit,
    ]);

    clearTimeout(batchTimeoutId);

    commitResolver = undefined;

    if (failure) throw failure;

    if (0 !== buffer.length) {
      yield buffer.splice(0, Math.min(buffer.length, batchSize));
    }
  }
}
