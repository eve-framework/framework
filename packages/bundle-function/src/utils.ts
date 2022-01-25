import * as childProcess from 'child_process';
import path from 'path';
import fs from 'fs';
import type { Runtime } from '@pulumi/aws/lambda';

export const runtimeToTarget = (runtime: Runtime | string) => {
  const match = runtime.match(/nodejs(\d+)/);

  if (!match) {
    throw new Error('Cannot extract version from runtime.');
  }

  return `node${match[1]}`;
};

export class SpawnError extends Error {
  constructor(message: string, public stdout: string, public stderr: string) {
    super(message);
    this.name = this.constructor.name;
  }

  toString() {
    return `${this.message}\n${this.stderr}`;
  }
}

/**
 * Executes a child process without limitations on stdout and stderr.
 * On error (exit code is not 0), it rejects with a SpawnProcessError that contains the stdout and stderr streams,
 * on success it returns the streams in an object.
 */
export const spawnProcess = (
  command: string,
  args: string[],
  options: childProcess.SpawnSyncOptions,
) => {
  const result = childProcess.spawnSync(command, args, { ...options, encoding: 'utf8' });

  const stdout = result.stdout.toString();
  const stderr = result.stderr.toString();

  if (result.status !== 0) {
    throw new SpawnError(
      `${command} ${args.join(' ')} failed with code ${result.status}`,
      stdout,
      stderr,
    );
  }

  return { stdout, stderr };
};

/**
 * Find a file by walking up parent directories
 */
export const findUp = (
  names: string | string[],
  directory: string = process.cwd(),
): string | undefined => {
  const absoluteDirectory = path.resolve(directory);

  let fileNames: string[] = [];
  if (typeof names === 'string') {
    fileNames = [names];
  } else {
    fileNames = names;
  }

  for (const fileName of fileNames) {
    if (fs.existsSync(path.join(directory, fileName))) {
      return directory;
    }
  }

  const { root } = path.parse(absoluteDirectory);
  if (absoluteDirectory === root) {
    return undefined;
  }

  return findUp(names, path.dirname(absoluteDirectory));
};

/**
 * Forwards `rootDir` or finds project root folder.
 */
export const findProjectRoot = (rootDir?: string): string | undefined =>
  rootDir ?? findUp(['yarn.lock', 'package-lock.json']);

export const readJsonFile = (filePath: string) => {
  if (fs.existsSync(filePath)) {
    return JSON.parse(fs.readFileSync(filePath).toString());
  }
  return null;
};
