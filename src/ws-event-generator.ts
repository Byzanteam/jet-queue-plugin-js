export async function* listen<E>(
  socket: WebSocket,
): AsyncIterable<MessageEvent<E>> {
  const waitList: Array<(event: MessageEvent<E>) => void> = [];
  const buffer: Array<MessageEvent<E>> = [];

  function pushEvent(event: MessageEvent<E>) {
    if (0 === waitList.length) {
      buffer.push(event);
    } else {
      const resolver = waitList.shift()!;
      resolver(event);
    }
  }

  socket.addEventListener("message", pushEvent);

  while (true) {
    if (0 === buffer.length) {
      await new Promise<MessageEvent<E>>((resolve) => {
        waitList.push(resolve);
      });
    } else {
      yield buffer.shift()!;
    }
  }
}
