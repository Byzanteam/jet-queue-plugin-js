import { assertEquals } from "@std/assert";
import { assertSpyCalls, spy } from "@std/testing/mock";
import { FakeTime } from "@std/testing/time";
import {
  type MessagesStreamOptions,
  messagesStream,
} from "./ws-event-generator.ts";

type MockSocket = {
  addEventListener: (
    event: string,
    handler: (e: MessageEvent<string>) => void,
  ) => void;
  send: (data: string) => void;
  emit: (event: string, data?: unknown) => void;
};

function createMockSocket(): MockSocket {
  const listeners = new Map<string, Array<(e: unknown) => void>>();

  return {
    addEventListener(event, handler) {
      const list = listeners.get(event) ?? [];
      list.push(handler as (e: unknown) => void);
      listeners.set(event, list);
    },
    send(_data: string) {},
    emit(event, data) {
      listeners.get(event)?.forEach((h) => h(data));
    },
  };
}

function defaultOptions<T>(
  overrides: Partial<MessagesStreamOptions<T>> = {},
): MessagesStreamOptions<T> {
  return {
    timeout: 5000,
    batchSize: 2,
    batchTimeout: 1000,
    dataBuilder: (event) => [event.data as unknown as T],
    ...overrides,
  };
}

Deno.test("messagesStream", async (t) => {
  await t.step("batchTimeout cleanup", async (t) => {
    await t.step(
      "clears the batchTimeout timer when commit wins the race",
      async () => {
        using _time = new FakeTime();
        const clearTimeoutSpy = spy(globalThis, "clearTimeout");

        try {
          const socket = createMockSocket();
          const stream = messagesStream<string>(
            socket as unknown as WebSocket,
            defaultOptions({ batchSize: 2, batchTimeout: 1000, timeout: 5000 }),
          ) as AsyncGenerator<string[]>;

          // Kick off generator and open socket (starts ping timer)
          const nextPromise = stream.next();
          socket.emit("open");

          // Two messages → beginResolver fires, then commitResolver fires
          socket.emit("message", new MessageEvent("message", { data: "msg1" }));
          socket.emit("message", new MessageEvent("message", { data: "msg2" }));

          const result = await nextPromise;
          assertEquals(result.value, ["msg1", "msg2"]);

          // clearTimeout must have been called exactly once for the batchTimeoutId
          assertSpyCalls(clearTimeoutSpy, 1);
        } finally {
          clearTimeoutSpy.restore();
        }
      },
    );
  });

  await t.step("ping timeout cleanup", async (t) => {
    await t.step(
      "clears the ping timer when the socket closes",
      async () => {
        using time = new FakeTime();
        const clearTimeoutSpy = spy(globalThis, "clearTimeout");

        let sendCallCount = 0;
        const socket = createMockSocket();
        socket.send = (_data: string) => {
          sendCallCount++;
        };

        try {
          const stream = messagesStream<string>(
            socket as unknown as WebSocket,
            defaultOptions({ timeout: 5000 }),
          ) as AsyncGenerator<string[]>;

          // Start generator and open socket (sends first ping, pong=false)
          stream.next();
          socket.emit("open");

          // Receive pong so next timer tick would re-ping instead of throwing
          socket.emit(
            "message",
            new MessageEvent("message", { data: "pong" }),
          );

          // Close the socket – should clear the ping timer
          socket.emit("close");

          // clearTimeout must have been called exactly once for the pingTimeoutId
          assertSpyCalls(clearTimeoutSpy, 1);

          // Advance past the ping interval; if the timer leaked, send would be called again
          const sendCountBeforeTick = sendCallCount;
          time.tick(5000);
          assertEquals(sendCallCount, sendCountBeforeTick);
        } finally {
          clearTimeoutSpy.restore();
        }
      },
    );
  });
});
