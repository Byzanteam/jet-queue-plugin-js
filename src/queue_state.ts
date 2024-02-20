import { JetQueue } from "./queue.ts";
import { JetQueueTesting } from "./testing.ts";

let testQueueInstance: JetQueueTesting | null = null;
const queues: { [queueName: string]: JetQueue } = {};

export function getTestQueueInstance(): JetQueueTesting | null {
  return testQueueInstance;
}

export function setTestQueueInstance(instance: JetQueueTesting | null) {
  testQueueInstance = instance;
}

export function getQueue(queueName: string): JetQueue | undefined {
  return queues[queueName];
}

export function setQueue(queueName: string, queue: JetQueue) {
  queues[queueName] = queue;
}
