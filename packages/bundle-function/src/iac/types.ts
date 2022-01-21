import { FunctionArgs } from '@pulumi/aws/lambda';
import { BuildOptions } from 'esbuild';

export interface BundlingArgs {
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

export interface BundleFunctionArgs extends Omit<FunctionArgs, 'code'> {
  entry: string;
  bundling?: BundlingArgs;
}
