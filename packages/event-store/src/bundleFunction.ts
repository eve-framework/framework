import path from 'path';
import { Function, FunctionArgs, Runtime } from '@pulumi/aws/lambda';
import type { CustomResourceOptions } from '@pulumi/pulumi';
import { FileArchive } from '@pulumi/pulumi/asset';
import { buildSync, BuildOptions } from 'esbuild';

interface BundlingArgs {
  nodeModules?: string[];
  externalModules?: string[];
  outputDir?: string;
  loader?: BuildOptions['loader'];
  define?: BuildOptions['define'];
  sourceMap?: BuildOptions['sourcemap'];
  sourcesContent?: BuildOptions['sourcesContent'];
  sourceRoot?: BuildOptions['sourceRoot'];
  resolveExtensions?: BuildOptions['resolveExtensions'];
  target?: BuildOptions['target'];
  logLevel?: BuildOptions['logLevel'];
  logLimit?: BuildOptions['logLimit'];
  minify?: BuildOptions['minify'];
  format?: BuildOptions['format'];
}
interface BundleFunctionArgs extends Omit<FunctionArgs, 'code'> {
  entry: string;
  bundling?: BundlingArgs;
}

const runtimeToTarget = (runtime: Runtime | string) => {
  const match = runtime.match(/nodejs(\d+)/);

  if (!match) {
    throw new Error('Cannot extract version from runtime.');
  }

  return `node${match[1]}`;
};

export class BundleFunction extends Function {
  constructor(name: string, args: BundleFunctionArgs, opts?: CustomResourceOptions) {
    const projectRoot = process.cwd();
    const { entry, bundling: bundlingArgs, ...functionArgs } = args;
    const runtime = functionArgs.runtime || Runtime.NodeJS14dX;

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
        code: new FileArchive(relativeOutputDir),
        runtime,
        handler: `index.${functionArgs.handler || 'handler'}`,
      },
      opts,
    );
  }
}
