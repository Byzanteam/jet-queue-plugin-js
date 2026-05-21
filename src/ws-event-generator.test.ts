import { assertEquals, assertRejects } from "@std/assert";
import { FakeTime } from "@std/testing/time";
import { messagesStream } from "./ws-event-generator.ts";

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

Deno.test("socket close throws to crash the consumer", async () => {
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
  socket.emit("close");

  await assertRejects(() => next, Error, "WebSocket closed");
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
