import path from 'path';
import * as pulumi from '@pulumi/pulumi';
import * as aws from '@pulumi/aws';
import { BundleFunction } from '@eve-framework/bundle-function';
import { resourceName } from './../utils';

export interface EventStoreWriteQueueSubscriptionOpts {
  batchSize?: number;
  maximumBatchingWindowInSeconds?: number;
}

export interface EventStoreWriteQueueOpts {
  queueSubscriptionOpts?: EventStoreWriteQueueSubscriptionOpts;
  eventTableName?: string | pulumi.Input<string>;
}

export class EventStoreWriteQueue extends pulumi.ComponentResource {
  readonly componentName: string;
  readonly writeQueueOpts: EventStoreWriteQueueOpts;
  readonly queue: aws.sqs.Queue;
  private defaultResourceOptions: pulumi.ResourceOptions;

  /**
   * Creates a new write queue for event store
   * @param name  The _unique_ name of the resource.
   * @param opts  A bag of options that control this resource's behavior.
   */
  constructor(
    name = 'writeQueue',
    writeQueueOpts?: EventStoreWriteQueueOpts,
    opts?: pulumi.ResourceOptions,
  ) {
    const inputs: pulumi.Inputs = {
      options: opts,
    };
    super('eve:components:EventStore:WriteQueue', resourceName(name), inputs, opts);
    this.defaultResourceOptions = { parent: this };
    this.writeQueueOpts = writeQueueOpts || {};
    this.componentName = name;

    this.queue = new aws.sqs.Queue(
      resourceName(`${this.componentName}`),
      {
        visibilityTimeoutSeconds: 180,
      },
      this.defaultResourceOptions,
    );

    const eventHandlerRole = new aws.iam.Role(
      resourceName(`${this.componentName}-handlerRole`),
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
            policy: this.queue.arn.apply(arn =>
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
      resourceName(`${this.componentName}-handler`),
      {
        entry: path.resolve(__dirname, '../handlers/writeEventHandler.js'),
        bundling: {
          sourceMap: true,
          externalModules: ['dynamodb-toolbox'],
        },
        role: eventHandlerRole.arn,
        environment: {
          variables: {
            NODE_OPTIONS: '--enable-source-maps',
            DYNAMODB_TABLE: this.writeQueueOpts.eventTableName || 'eventTable',
          },
        },
      },
      { ...this.defaultResourceOptions, dependsOn: [eventHandlerRole] },
    );

    this.queue.onEvent(
      resourceName(`${this.componentName}-subscription`),
      eventHandler,
      this.writeQueueOpts.queueSubscriptionOpts,
      {
        ...this.defaultResourceOptions,
        dependsOn: [eventHandler],
      },
    );
  }
}
