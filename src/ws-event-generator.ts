type ListenEvent<E> =
  | {
    type: "message";
    event: MessageEvent<E>;
  }
  | {
    type: "close";
    event: CloseEvent;
  }
  | {
    type: "error";
    event: Event | ErrorEvent;
  };

export async function* listen<E>(
  socket: WebSocket,
): AsyncIterable<ListenEvent<E>> {
  const pullQueue: Array<(event: ListenEvent<E>) => void> = [];
  const pushQueue: Array<ListenEvent<E>> = [];

  let listening = true;

  function pushEvent(event: ListenEvent<E>) {
    if (0 === pullQueue.length) {
      pushQueue.push(event);
    } else {
      const resolver = pullQueue.shift()!;
      resolver(event);
    }
  }

  function handleMessage(event: MessageEvent) {
    pushEvent({ type: "message", event });
  }

  function handleError(event: Event | ErrorEvent) {
    pushEvent({ type: "error", event });
    stopListening();
  }

  function handleClose(event: CloseEvent) {
    pushEvent({ type: "close", event });
    stopListening();
  }

  function stopListening() {
    socket.removeEventListener("message", handleMessage);
    socket.removeEventListener("error", handleError);
    socket.removeEventListener("close", handleClose);

    listening = false;
  }

  socket.addEventListener("message", handleMessage);
  socket.addEventListener("error", handleError);
  socket.addEventListener("close", handleClose);

  // 即使出现错误或者断连了，pushQueue 中未处理的消息仍然需要 yield 出去
  // 包括错误和断连产生的 Event | ErrorEvent | CloseEvent
  while (listening || pushQueue.length > 0) {
    if (0 === pushQueue.length) {
      await new Promise<ListenEvent<E>>((resolve) => {
        pullQueue.push(resolve);
      });
    } else {
      yield pushQueue.shift()!;
    }
  }
}
