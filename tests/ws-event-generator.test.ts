import { assertEquals, assertRejects } from "@std/assert";
import { assertSpyCalls, spy } from "@std/testing/mock";
import { FakeTime } from "@std/testing/time";
import { messagesStream } from "../src/ws-event-generator.ts";

type MockSocket = {
  addEventListener: (event: string, handler: (e: unknown) => void) => void;
  send: (data: string) => void;
  close: () => void;
  closed: boolean;
  emit: (event: string, data?: unknown) => void;
};

function createMockSocket(): MockSocket {
  const listeners = new Map<string, Array<(e: unknown) => void>>();

  return {
    closed: false,
    addEventListener(event, handler) {
      const list = listeners.get(event) ?? [];
      list.push(handler);
      listeners.set(event, list);
    },
    send(_data: string) {},
    close() {
      this.closed = true;
    },
    emit(event, data) {
      listeners.get(event)?.forEach((h) => h(data));
    },
  };
}

function message(data: string): MessageEvent<string> {
  return new MessageEvent("message", { data });
}

Deno.test("messagesStream yields batched jobs", async () => {
  using _time = new FakeTime();
  const socket = createMockSocket();

  const stream = messagesStream<string>(socket as unknown as WebSocket, {
    timeout: 5000,
    batchSize: 2,
    batchTimeout: 1000,
    dataBuilder: (event) => [event.data],
  });

  const next = stream[Symbol.asyncIterator]().next();
  socket.emit("open");
  socket.emit("message", message("a"));
  socket.emit("message", message("b"));

  const result = await next;
  assertEquals(result.value, ["a", "b"]);
});

Deno.test("flushes the leftover of an overfull batch without a new message", async () => {
  using time = new FakeTime();
  const socket = createMockSocket();

  const iterator = messagesStream<string>(socket as unknown as WebSocket, {
    timeout: 5000,
    batchSize: 2,
    batchTimeout: 1000,
    dataBuilder: (event) => [event.data],
  })[Symbol.asyncIterator]();

  const first = iterator.next();
  socket.emit("open");
  socket.emit("message", message("a"));
  socket.emit("message", message("b"));
  socket.emit("message", message("c"));

  assertEquals((await first).value, ["a", "b"]);

  // No further message arrives; the leftover "c" must flush on batchTimeout
  // rather than blocking until the next message.
  const second = iterator.next();
  await time.tickAsync(1000);

  assertEquals((await second).value, ["c"]);
});

Deno.test("clears the batch timer when commit wins the race", async () => {
  using _time = new FakeTime();
  const clearTimeoutSpy = spy(globalThis, "clearTimeout");

  try {
    const socket = createMockSocket();
    const iterator = messagesStream<string>(socket as unknown as WebSocket, {
      timeout: 5000,
      batchSize: 2,
      batchTimeout: 1000,
      dataBuilder: (event) => [event.data],
    })[Symbol.asyncIterator]();

    const next = iterator.next();
    socket.emit("open");
    socket.emit("message", message("a"));
    socket.emit("message", message("b"));

    const result = await next;
    assertEquals(result.value, ["a", "b"]);

    // batch timer must be cleared once commit (batchSize reached) wins the race
    assertSpyCalls(clearTimeoutSpy, 1);
  } finally {
    clearTimeoutSpy.restore();
  }
});

Deno.test("ping timeout closes the socket and throws", async () => {
  using time = new FakeTime();
  const socket = createMockSocket();

  const iterator = messagesStream<string>(socket as unknown as WebSocket, {
    timeout: 5000,
    batchSize: 2,
    batchTimeout: 1000,
    dataBuilder: (event) => [event.data],
  })[Symbol.asyncIterator]();

  const next = iterator.next();
  socket.emit("open"); // sends first ping, sets pong=false

  // No pong arrives; advancing past the interval triggers the timeout
  await time.tickAsync(5000);

  await assertRejects(() => next, Error, "Ping timeout");
  assertEquals(socket.closed, true);
});

Deno.test("clean socket close ends the stream without throwing", async () => {
  using _time = new FakeTime();
  const socket = createMockSocket();

  const iterator = messagesStream<string>(socket as unknown as WebSocket, {
    timeout: 5000,
    batchSize: 2,
    batchTimeout: 1000,
    dataBuilder: (event) => [event.data],
  })[Symbol.asyncIterator]();

  const next = iterator.next();
  socket.emit("open");
  socket.emit("close", { wasClean: true, code: 1000 });

  const result = await next;
  assertEquals(result.done, true);
});

Deno.test("abnormal socket close throws to crash the consumer", async () => {
  using _time = new FakeTime();
  const socket = createMockSocket();

  const iterator = messagesStream<string>(socket as unknown as WebSocket, {
    timeout: 5000,
    batchSize: 2,
    batchTimeout: 1000,
    dataBuilder: (event) => [event.data],
  })[Symbol.asyncIterator]();

  const next = iterator.next();
  socket.emit("open");
  socket.emit("close", { wasClean: false, code: 1006 });

  await assertRejects(() => next, Error, "WebSocket closed (code 1006)");
});

Deno.test("socket error throws to crash the consumer", async () => {
  using _time = new FakeTime();
  const socket = createMockSocket();

  const iterator = messagesStream<string>(socket as unknown as WebSocket, {
    timeout: 5000,
    batchSize: 2,
    batchTimeout: 1000,
    dataBuilder: (event) => [event.data],
  })[Symbol.asyncIterator]();

  const next = iterator.next();
  socket.emit("open");
  socket.emit("error");

  await assertRejects(() => next, Error, "WebSocket error");
});
