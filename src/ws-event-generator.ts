export async function* listen<E, D>(
  socket: WebSocket,
  batchSize: number,
  batchTimeout: number,
  dataBuilder: (event: MessageEvent<E>) => Array<D>,
): AsyncIterable<Array<D>> {
  const buffer: Array<D> = [];
  let resolver: (() => void) | undefined = undefined;

  function pushEvent(event: MessageEvent<E>) {
    buffer.push(...dataBuilder(event));

    if (resolver && buffer.length >= batchSize) {
      const oldResolver = resolver;
      resolver = undefined;
      oldResolver();
    }
  }

  socket.addEventListener("message", pushEvent);

  while (true) {
    await Promise.race([
      new Promise<void>((resolve) => setTimeout(resolve, batchTimeout)),
      new Promise<void>((resolve) => {
        resolver = resolve;
      }),
    ]);

    if (0 !== buffer.length) {
      yield transfer(buffer, Math.min(buffer.length, batchSize));
    }
  }
}

function transfer<T>(arr: Array<T>, size: number): Array<T> {
  const result: Array<T> = [];

  for (let i = 0; i < size; i++) {
    result.push(arr.shift()!);
  }

  return result;
}
