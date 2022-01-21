import path from 'path';
import * as aws from '@pulumi/aws';
import * as pulumi from '@pulumi/pulumi';
import { buildSync } from 'esbuild';
import { runtimeToTarget } from './utils';
import { BundleFunctionArgs } from './types';
export class BundleFunction extends aws.lambda.Function {
  constructor(name: string, args: BundleFunctionArgs, opts?: pulumi.CustomResourceOptions) {
    const projectRoot = process.cwd();
    const { entry, bundling: bundlingArgs, ...functionArgs } = args;
    const runtime = functionArgs.runtime || aws.lambda.Runtime.NodeJS14dX;

    const {
      externalModules = ['aws-sdk'],
      nodeModules = [],
      outputDir = 'dist',
      sourceMap,
      target,
      ...esbuildArgs
    } = bundlingArgs || {};

    const relativeOutputDir = path.resolve(projectRoot, outputDir, name);
    const outFile = esbuildArgs.format === 'esm' ? 'index.mjs' : 'index.js';

    buildSync({
      ...esbuildArgs,
      entryPoints: [entry],
      bundle: true,
      platform: 'node',
      target: target || runtimeToTarget(runtime.toString()),
      sourcemap: sourceMap,
      outfile: path.join(relativeOutputDir, outFile),
      external: [...externalModules, ...nodeModules],
    });

    super(
      name,
      {
        ...functionArgs,
        code: new pulumi.asset.FileArchive(relativeOutputDir),
        runtime,
        handler: `index.${functionArgs.handler || 'handler'}`,
      },
      opts,
    );
  }
}
