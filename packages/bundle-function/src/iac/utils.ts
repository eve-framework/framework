import type { Runtime } from '@pulumi/aws/lambda';

export const runtimeToTarget = (runtime: Runtime | string) => {
  const match = runtime.match(/nodejs(\d+)/);

  if (!match) {
    throw new Error('Cannot extract version from runtime.');
  }

  return `node${match[1]}`;
};
