import type { Callback } from '@pulumi/aws/lambda';
import type { QueueEvent } from '@pulumi/aws/sqs';
import { Table } from 'dynamodb-toolbox';

export const handler: Callback<QueueEvent, void> = async _ => {
  const table = new Table({
    name: process.env.DYNAMODB_TABLE || '',
    partitionKey: 'id',
  });

  console.error(table.name);
};
