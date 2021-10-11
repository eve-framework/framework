import { EventStore } from '@eve-framework/event-store/iac';

const store = new EventStore('example-event-store');

store.createWriteQueue('customer');
