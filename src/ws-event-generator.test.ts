import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  type MessagesStreamOptions,
  messagesStream,
} from "./ws-event-generator";

type MockSocket = {
  addEventListener: (
    event: string,
    handler: (e: MessageEvent<string>) => void,
  ) => void;
  send: ReturnType<typeof vi.fn>;
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
    send: vi.fn(),
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

describe("messagesStream", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe("batchTimeout cleanup", () => {
    it("clears the batchTimeout timer when commit wins the race", async () => {
      const socket = createMockSocket();
      const stream = messagesStream<string>(
        socket as unknown as WebSocket,
        defaultOptions({ batchSize: 2, batchTimeout: 1000, timeout: 5000 }),
      );

      // Kick off generator and open socket (starts ping timer)
      const nextPromise = stream.next();
      socket.emit("open");

      // Two messages → beginResolver fires, then commitResolver fires
      socket.emit("message", new MessageEvent("message", { data: "msg1" }));
      socket.emit("message", new MessageEvent("message", { data: "msg2" }));

      const result = await nextPromise;
      expect(result.value).toEqual(["msg1", "msg2"]);

      // After commit wins the race the batchTimeout timer must have been cleared.
      // Only the ping timer (one setTimeout(ping, 5000)) should remain.
      expect(vi.getTimerCount()).toBe(1);
    });
  });

  describe("ping timeout cleanup", () => {
    it("clears the ping timer when the socket closes", async () => {
      const socket = createMockSocket();
      const stream = messagesStream<string>(
        socket as unknown as WebSocket,
        defaultOptions({ timeout: 5000 }),
      );

      // Start generator and open socket (starts ping timer)
      stream.next();
      socket.emit("open");

      // One ping timer should be running
      expect(vi.getTimerCount()).toBe(1);

      // Close the socket – the ping timer must be cleared
      socket.emit("close");

      expect(vi.getTimerCount()).toBe(0);
    });
  });
});
