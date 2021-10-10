import pulumi from '@pulumi/pulumi';
import aws from '@pulumi/aws';

export class EventStore extends pulumi.ComponentResource {
  readonly eventTable: aws.dynamodb.Table;

  /**
   * Creates a new event store
   * @param name  The _unique_ name of the resource.
   * @param opts  A bag of options that control this resource's behavior.
   */
  constructor(name: string, opts?: pulumi.ResourceOptions) {
    const inputs: pulumi.Inputs = {
      options: opts,
    };
    super('eve:components:EventStore', name, inputs, opts);
    const defaultResourceOptions: pulumi.ResourceOptions = { parent: this };

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
      },
      defaultResourceOptions,
    );
  }
}
