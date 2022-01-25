import { SpawnError, spawnProcess } from '../utils';
import { Packager, JSONObject } from './types';

const convertTrees = (convertingTrees: JSONObject[]) =>
  convertingTrees.reduce((carry, tree: JSONObject) => {
    const splitModule: string[] = tree.name?.split('@') || [];
    // If we have a scoped module we have to re-add the @
    if (typeof tree.name === 'string' && tree.name.startsWith('@')) {
      splitModule.splice(0, 1);
      splitModule[0] = '@' + splitModule[0];
    }

    carry[splitModule[0]] = {
      version: splitModule.splice(1, splitModule.length - 1).join('@'),
      dependencies: convertTrees(tree.children),
    };
    return carry;
  }, {});

export class Yarn implements Packager {
  get lockfileName() {
    return 'yarn.lock';
  }

  get copyPackageSectionNames() {
    return ['resolutions'];
  }

  getProdDependencies(cwd: string, depth?: number) {
    const command = /^win/.test(process.platform) ? 'yarn.cmd' : 'yarn';
    const args = ['list', `--depth=${depth || 1}`, '--json', '--production'];

    let processOutput;
    try {
      processOutput = spawnProcess(command, args, { cwd });
    } catch (err) {
      if (err instanceof SpawnError) {
        if (err.stdout && err.stdout !== '') {
          return { stdout: err.stdout };
        }
      }

      throw err;
    }

    const lines = processOutput?.stdout?.split(/\r?\n/) || [];
    const parsedLines = lines.map(line => {
      try {
        return JSON.parse(line);
      } catch (e) {
        return null;
      }
    });
    const parsedTree = parsedLines.find(line => line && line.type === 'tree');

    const trees = parsedTree?.['data']?.['trees'] || [];
    const result = {
      problems: [],
      dependencies: convertTrees(trees),
    };
    return result;
  }

  rebaseLockfile(pathToPackageRoot: string, lockfile: string) {
    const fileVersionMatcher = /[^"/]@(?:file:)?((?:\.\/|\.\.\/).*?)[":,]/gm;
    type Replacement = { oldRef: string; newRef: string };
    const replacements: Replacement[] = [];
    let match;

    // Detect all references and create replacement line strings
    while ((match = fileVersionMatcher.exec(lockfile)) !== null) {
      replacements.push({
        oldRef: match[1],
        newRef: `${pathToPackageRoot}/${match[1]}`.replace(/\\/g, '/'),
      });
    }

    // Replace all lines in lockfile
    return replacements.reduce<string>(
      (carry, replacement) => carry.replace(replacement.oldRef, replacement.newRef),
      lockfile,
    );
  }

  install(cwd: string, extraArgs: Array<string>, useLockfile = true) {
    const command = /^win/.test(process.platform) ? 'yarn.cmd' : 'yarn';

    const args = useLockfile
      ? ['install', '--frozen-lockfile', '--non-interactive', ...extraArgs]
      : ['install', '--non-interactive', ...extraArgs];

    spawnProcess(command, args, { cwd });
  }

  // "Yarn install" prunes automatically
  prune(cwd: string) {
    return this.install(cwd, []);
  }

  async runScripts(cwd: string, scriptNames: string[]) {
    const command = /^win/.test(process.platform) ? 'yarn.cmd' : 'yarn';
    await Promise.all(
      scriptNames.map(scriptName => spawnProcess(command, ['run', scriptName], { cwd })),
    );
  }
}
