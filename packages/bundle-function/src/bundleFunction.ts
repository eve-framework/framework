import * as aws from '@pulumi/aws';
import * as pulumi from '@pulumi/pulumi';
import { runtimeToTarget } from './utils';
import { BundleFunctionArgs } from './types';
import { bundleFunction } from './bundling';
export class BundleFunction extends aws.lambda.Function {
  constructor(name: string, args: BundleFunctionArgs, opts?: pulumi.CustomResourceOptions) {
    const { entry, bundling: bundlingArgs, ...functionArgs } = args;
    const runtime = functionArgs.runtime || aws.lambda.Runtime.NodeJS14dX;
    const target = bundlingArgs?.target || runtimeToTarget(runtime.toString());

    const outputDir = bundleFunction(
      {
        name,
        entry,
        projectRoot: process.cwd(),
      },
      { ...(bundlingArgs || {}), target },
    );

    super(
      name,
      {
        ...functionArgs,
        code: new pulumi.asset.FileArchive(outputDir),
        runtime,
        handler: `index.${functionArgs.handler || 'handler'}`,
      },
      opts,
    );
  }
}
