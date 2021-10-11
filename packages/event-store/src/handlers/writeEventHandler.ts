import type { SQSHandler } from 'aws-lambda';

export const handler: SQSHandler = e => {
  console.error(e);
};
