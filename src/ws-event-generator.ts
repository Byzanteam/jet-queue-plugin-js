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
      if (pong) {
        pong = false;
        socket.send("ping");
        setTimeout(ping, timeout);
      } else {
        throw new Error("Ping timeout");
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

  while (true) {
    const commit = new Promise<void>((resolve) => {
      commitResolver = resolve;
    });

    await new Promise<void>((resolve) => {
      beginResolver = resolve;
    });

    beginResolver = undefined;

    await Promise.race([
      new Promise<void>((resolve) => setTimeout(resolve, batchTimeout)),
      commit,
    ]);

    commitResolver = undefined;

    if (0 !== buffer.length) {
      yield buffer.splice(0, Math.min(buffer.length, batchSize));
    }
  }
}
