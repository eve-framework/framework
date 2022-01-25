import path from 'path';
import { buildSync } from 'esbuild';
import { BundlingArgs } from './types';
import { packExternalModules } from './packExternals';

interface FunctionArgs {
  entry: string;
  name: string;
  projectRoot: string;
}

export const bundleFunction = async (functionArgs: FunctionArgs, bundlingArgs: BundlingArgs) => {
  const {
    externalModules = ['aws-sdk'],
    nodeModules = [],
    outputDir = 'dist',
    sourceMap,
    target,
    ...esbuildArgs
  } = bundlingArgs;

  const relativeOutputDir = path.resolve(functionArgs.projectRoot, outputDir, functionArgs.name);
  const outFile = esbuildArgs.format === 'esm' ? 'index.mjs' : 'index.js';

  buildSync({
    ...esbuildArgs,
    entryPoints: [functionArgs.entry],
    bundle: true,
    platform: 'node',
    target: target,
    sourcemap: sourceMap,
    outfile: path.join(relativeOutputDir, outFile),
    external: [...externalModules, ...nodeModules],
  });

  packExternalModules(relativeOutputDir, [...externalModules, ...nodeModules]);

  return relativeOutputDir;
};
