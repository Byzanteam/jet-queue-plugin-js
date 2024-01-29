export async function* listen<E, D>(
  socket: WebSocket,
  batchSize: number,
  batchTimeout: number,
  dataBuilder: (event: MessageEvent<E>) => Array<D>,
): AsyncIterable<Array<D>> {
  const buffer: Array<D> = [];

  let beginResolver: (() => void) | undefined = undefined;
  let commitResolver: (() => void) | undefined = undefined;

  function pushEvent(event: MessageEvent<E>) {
    if (beginResolver) {
      beginResolver();
    }

    buffer.push(...dataBuilder(event));

    if (commitResolver && buffer.length >= batchSize) {
      const oldCommitResolver = commitResolver;
      commitResolver = undefined;
      oldCommitResolver();
    }
  }

  socket.addEventListener("message", pushEvent);

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
