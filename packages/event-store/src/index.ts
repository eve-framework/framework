import path from 'path';
import * as pulumi from '@pulumi/pulumi';
import * as aws from '@pulumi/aws';
import { BundleFunction } from './bundleFunction';

type CreateWriteQueueOps = {
  batchSize?: number;
  maximumBatchingWindowInSeconds?: number;
};

type EventTableOpts = {
  billingMode?: 'PAY_PER_REQUEST' | 'PROVISIONED';
  writeCapacity?: number;
  readCapacity?: number;
};

interface EventStoreOpts {
  eventTableOpts?: EventTableOpts;
}

export class EventStore extends pulumi.ComponentResource {
  readonly eventTable: aws.dynamodb.Table;
  readonly eventStoreOpts: EventStoreOpts;
  private defaultResourceOptions: pulumi.ResourceOptions;

  /**
   * Creates a new event store
   * @param name  The _unique_ name of the resource.
   * @param opts  A bag of options that control this resource's behavior.
   */
  constructor(name: string, eventStoreOpts?: EventStoreOpts, opts?: pulumi.ResourceOptions) {
    const inputs: pulumi.Inputs = {
      options: opts,
    };
    super('eve:components:EventStore', name, inputs, opts);
    this.defaultResourceOptions = { parent: this };
    this.eventStoreOpts = eventStoreOpts || {};

    this.eventTable = new aws.dynamodb.Table(
      `${pulumi.getStack()}-${pulumi.getProject()}-events`,
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

  public createWriteQueue(name: string, opts?: CreateWriteQueueOps) {
    const queue = new aws.sqs.Queue(
      name,
      {
        visibilityTimeoutSeconds: 180,
      },
      this.defaultResourceOptions,
    );

    const eventHandlerRole = new aws.iam.Role(
      `${name}-event-handler-role`,
      {
        assumeRolePolicy: {
          Version: '2012-10-17',
          Statement: [
            {
              Action: 'sts:AssumeRole',
              Principal: {
                Service: 'lambda.amazonaws.com',
              },
              Effect: 'Allow',
              Sid: '',
            },
          ],
        },
        inlinePolicies: [
          {
            name: 'sqs-message',
            policy: queue.arn.apply(arn =>
              aws.iam
                .getPolicyDocument({
                  statements: [
                    {
                      actions: [
                        'sqs:ReceiveMessage',
                        'sqs:DeleteMessage',
                        'sqs:GetQueueAttributes',
                      ],
                      effect: 'Allow',
                      resources: [arn],
                    },
                  ],
                })
                .then(p => p.json),
            ),
          },
        ],
        managedPolicyArns: [aws.iam.ManagedPolicy.AWSLambdaExecute],
      },
      this.defaultResourceOptions,
    );

    const eventHandler = new BundleFunction(
      `${name}-event-handler`,
      {
        entries: [path.resolve(__dirname, './handlers/writeEventHandler.js')],
        role: eventHandlerRole.arn,
        environment: {
          variables: {
            DYNAMODB_TABLE: this.eventTable.name,
          },
        },
      },
      { ...this.defaultResourceOptions, dependsOn: [eventHandlerRole] },
    );

    queue.onEvent(`${name}-event-subscription`, eventHandler, opts, {
      ...this.defaultResourceOptions,
      dependsOn: [eventHandler],
    });

    return {
      queue,
      eventHandler,
    };
  }
}
