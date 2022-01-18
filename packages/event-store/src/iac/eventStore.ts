import * as pulumi from '@pulumi/pulumi';
import * as aws from '@pulumi/aws';
import { resourceName } from '../utils';
import { EventStoreWriteQueue, EventStoreWriteQueueSubscriptionOpts } from './writeQueue';

interface EventStoreTableOpts {
  billingMode?: 'PAY_PER_REQUEST' | 'PROVISIONED';
  writeCapacity?: number;
  readCapacity?: number;
}

export interface EventStoreOpts {
  eventTableOpts?: EventStoreTableOpts;
}

export class EventStore extends pulumi.ComponentResource {
  readonly componentName: string;
  readonly eventTable: aws.dynamodb.Table;
  readonly eventStoreOpts: EventStoreOpts;
  private defaultResourceOptions: pulumi.ResourceOptions;

  /**
   * Creates a new event store
   * @param name  The _unique_ name of the resource.
   * @param opts  A bag of options that control this resource's behavior.
   */
  constructor(name = 'eventStore', eventStoreOpts?: EventStoreOpts, opts?: pulumi.ResourceOptions) {
    const inputs: pulumi.Inputs = {
      options: opts,
    };
    super('eve:components:EventStore', resourceName(name), inputs, opts);
    this.defaultResourceOptions = { parent: this };
    this.eventStoreOpts = eventStoreOpts || {};
    this.componentName = name;

    this.eventTable = new aws.dynamodb.Table(
      resourceName(`${this.componentName}-table`),
      {
        hashKey: 'eventId',
        attributes: [
          {
            name: 'eventId',
            type: 'S',
          },
        ],
        billingMode: 'PAY_PER_REQUEST',
        ...eventStoreOpts?.eventTableOpts,
      },
      this.defaultResourceOptions,
    );
  }

  public createWriteQueue(
    name?: string,
    queueSubscriptionOpts?: EventStoreWriteQueueSubscriptionOpts,
  ) {
    return new EventStoreWriteQueue(
      name ? `${this.componentName}-${name}WQ` : `${this.componentName}-writeQueue`,
      {
        queueSubscriptionOpts,
        eventTableName: this.eventTable.name,
      },
      this.defaultResourceOptions,
    );
  }
}
