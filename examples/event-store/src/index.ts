import { EventStore } from '@eve-framework/event-store';

const store = new EventStore('example-event-store');

store.createWriteQueue('customer');
