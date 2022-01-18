import { Function, FunctionArgs, Runtime } from '@pulumi/aws/lambda';
import type { CustomResourceOptions } from '@pulumi/pulumi';
import { AssetArchive, StringAsset } from '@pulumi/pulumi/asset';
import { buildSync } from 'esbuild';

interface BundleFunctionArgs extends Omit<FunctionArgs, 'code'> {
  entries: string[];
}

export class BundleFunction extends Function {
  constructor(name: string, args: BundleFunctionArgs, opts?: CustomResourceOptions) {
    const outFile = 'index.js';
    const result = buildSync({
      write: false,
      bundle: true,
      platform: 'node',
      target: 'node14',
      outfile: outFile,
      entryPoints: args.entries,
    });

    super(
      name,
      {
        ...args,
        code: new AssetArchive({
          [outFile]: new StringAsset(result.outputFiles[0].text),
          'meta.json': new StringAsset(JSON.stringify(result.metafile?.outputs || {})),
        }),
        handler: 'index.handler',
        runtime: args.runtime || Runtime.NodeJS14dX,
      },
      opts,
    );
  }
}
