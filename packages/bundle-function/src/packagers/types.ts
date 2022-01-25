// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type JSONObject = any;

export interface Packager {
  lockfileName: string;
  copyPackageSectionNames: Array<string>;
  getProdDependencies(cwd: string, depth?: number): JSONObject;
  rebaseLockfile(pathToPackageRoot: string, lockfile: JSONObject): JSONObject;
  install(cwd: string, extraArgs: Array<string>, useLockfile?: boolean): void;
  prune(cwd: string): void;
  runScripts(cwd: string, scriptNames: string[]): void;
}
