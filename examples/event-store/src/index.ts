import { EventStore } from '@eve-framework/event-store';
import { Output } from '@pulumi/pulumi';

const store = new EventStore();

const genericWriteQueue = store.createWriteQueue();
const customerWriteQueue = store.createWriteQueue('customer');

export const customerWriteQueueName: Output<string> = customerWriteQueue.queue.name;
export const genericWriteQueueName: Output<string> = genericWriteQueue.queue.name;
