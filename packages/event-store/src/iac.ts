import path from 'path';
import * as pulumi from '@pulumi/pulumi';
import * as aws from '@pulumi/aws';
export const test = () => '1';

type CreateWriteQueueOps = {
  batchSize?: number;
  maximumBatchingWindowInSeconds?: number;
};

type EventTableOpts = {
  billingMode?: 'PAY_PER_REQUEST' | 'PROVISIONED';
  writeCapacity?: number;
  readCapacity?: number;
};

type EventStoreOpts = {
  eventTableOpts?: EventTableOpts;
};

export class EventStore extends pulumi.ComponentResource {
  readonly eventTable: aws.dynamodb.Table;
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
    const queue = new aws.sqs.Queue(name, undefined, this.defaultResourceOptions);

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
      },
      this.defaultResourceOptions,
    );

    const eventHandler = new aws.lambda.Function(
      `${name}-event-handler`,
      {
        code: new pulumi.asset.AssetArchive({
          '.': new pulumi.asset.FileArchive(
            path.resolve(__dirname + './../../handlers/writeEventHandler'),
          ),
        }),
        handler: 'index.handler',
        runtime: aws.lambda.Runtime.NodeJS14dX,
        role: eventHandlerRole.arn,
      },
      { ...this.defaultResourceOptions, dependsOn: [eventHandlerRole] },
    );

    queue.onEvent(`${name}-event-subscription`, eventHandler, opts, {
      ...this.defaultResourceOptions,
      dependsOn: [eventHandlerRole],
    });

    return {
      queue,
      eventHandler,
    };
  }
}
