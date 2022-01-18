import * as pulumi from '@pulumi/pulumi';
export const resourceName = (name: string) => `${pulumi.getStack()}-${pulumi.getProject()}-${name}`;
