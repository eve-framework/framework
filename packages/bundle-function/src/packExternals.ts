import path from 'path';
import fs from 'fs';
import { findProjectRoot, findUp, readJsonFile } from './utils';
import * as Packagers from './packagers';
import { JSONObject } from './packagers/types';

export const packExternalModules = (outputDir: string, externals: string[] = []) => {
  // Read plugin configuration
  // get the root package.json by looking up until we hit a lockfile
  // if this is a yarn workspace, it will be the monorepo package.json
  const rootPackageJsonPath = path.join(findProjectRoot() || '', './package.json');

  // get the local package.json by looking up until we hit a package.json file
  // if this is *not* a yarn workspace, it will be the same as rootPackageJsonPath
  const packageJsonPath = path.join(findUp('package.json') || './', './package.json');

  // Determine and create packager
  const packager = Packagers.get('yarn');

  // Fetch needed original package.json sections
  const sectionNames = packager.copyPackageSectionNames;

  const rootPackageJson: Record<string, unknown> = readJsonFile(rootPackageJsonPath);

  const isWorkspace = !!rootPackageJson.workspaces;

  const packageJson: Record<string, unknown> = isWorkspace
    ? readJsonFile(packageJsonPath)
    : rootPackageJson;

  const packageSections = pick(packageJson, sectionNames);

  const externalModules = externals.map(external => ({ external }));

  const compositeModules = [
    ...new Set(getProdModules(externalModules || [], packageJsonPath, rootPackageJsonPath)),
  ];

  if (compositeModules.length <= 0) {
    // eslint-disable-next-line no-console
    console.log('No external modules needed');
  }

  // (1.a) Install all needed modules
  const compositePackageJson = path.join(outputDir, 'package.json');

  // (1.a.1) Create a package.json
  const compositePackage = {
    name: 'package',
    version: '1.0.0',
    description: `Packaged externals for package`,
    private: true,
    ...packageSections,
  };

  const relativePath = path.relative(outputDir, path.dirname(packageJsonPath));
  addModulesToPackageJson(compositeModules, compositePackage, relativePath);

  fs.writeFileSync(compositePackageJson, JSON.stringify(compositePackage, null, 2));

  // (1.a.2) Copy package-lock.json if it exists, to prevent unwanted upgrades
  const packageLockPath = path.join(path.dirname(packageJsonPath), packager.lockfileName);
  const exists = fs.existsSync(packageLockPath);
  if (exists) {
    // eslint-disable-next-line no-console
    console.log('Package lock found - Using locked versions');
    try {
      let packageLockFile = readJsonFile(packageLockPath);
      packageLockFile = packager.rebaseLockfile(relativePath, packageLockFile);
      if (typeof packageLockFile === 'object') {
        packageLockFile = JSON.stringify(packageLockFile, null, 2);
      }

      fs.writeFileSync(path.join(outputDir, packager.lockfileName), packageLockFile as string);
    } catch (err) {
      console.error(
        `Warning: Could not read lock file: ${err instanceof Error ? err.message : ''}`,
      );
    }
  }

  const start = Date.now();
  // eslint-disable-next-line no-console
  console.log('Packing external modules: ' + compositeModules.join(', '));
  const installExtraArgs: string[] = [];
  packager.install(outputDir, installExtraArgs, exists);
  // eslint-disable-next-line no-console
  console.log(`Package took [${Date.now() - start} ms]`);

  // Prune extraneous packages - removes not needed ones
  const startPrune = Date.now();
  packager.prune(outputDir);
  // eslint-disable-next-line no-console
  console.log(`Prune: ${outputDir} [${Date.now() - startPrune} ms]`);
};

export const getProdModules = (
  externalModules: { external: string }[],
  packageJsonPath: string,
  rootPackageJsonPath: string,
) => {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const packageJson = require(packageJsonPath);
  const prodModules: string[] = [];

  // only process the module stated in dependencies section
  if (!packageJson.dependencies) {
    return [];
  }

  // Get versions of all transient modules
  externalModules.forEach(externalModule => {
    // (1) If not present in Dev Dependencies or Dependencies
    if (
      !packageJson.dependencies[externalModule.external] &&
      !packageJson.devDependencies[externalModule.external]
    ) {
      // eslint-disable-next-line no-console
      console.log(
        `INFO: Runtime dependency '${externalModule.external}' not found in dependencies or devDependencies. It has been excluded automatically.`,
      );
      return;
    }

    // (2) If present in Dev Dependencies
    if (
      !packageJson.dependencies[externalModule.external] &&
      packageJson.devDependencies[externalModule.external]
    ) {
      // To minimize the chance of breaking setups we whitelist packages available on AWS here. These are due to the previously missing check
      // most likely set in devDependencies and should not lead to an error now.
      const ignoredDevDependencies = ['aws-sdk'];

      if (!ignoredDevDependencies.includes(externalModule.external)) {
        // Runtime dependency found in devDependencies but not forcefully excluded
        console.error(
          `ERROR: Runtime dependency '${externalModule.external}' found in devDependencies.`,
        );
        throw new Error(`Dependency error: ${externalModule.external}.`);
      }

      // eslint-disable-next-line no-console
      console.log(
        `INFO: Runtime dependency '${externalModule.external}' found in devDependencies. It has been excluded automatically.`,
      );

      return;
    }
    // (3) otherwise let's get the version

    // get module package - either from root or local node_modules - will be used for version and peer deps
    const rootModulePackagePath = path.join(
      path.dirname(rootPackageJsonPath),
      'node_modules',
      externalModule.external,
      'package.json',
    );
    const localModulePackagePath = path.join(
      path.dirname(packageJsonPath),
      'node_modules',
      externalModule.external,
      'package.json',
    );
    const modulePackagePath = fs.existsSync(localModulePackagePath)
      ? localModulePackagePath
      : fs.existsSync(rootModulePackagePath)
      ? rootModulePackagePath
      : null;
    const modulePackage = modulePackagePath ? require(modulePackagePath) : {};

    // Get version
    const moduleVersion =
      packageJson.dependencies[externalModule.external] || modulePackage.version;

    // add dep with version if we have it - versionless otherwise
    if (moduleVersion) {
      prodModules.push(`${externalModule.external}@${moduleVersion}`);
    } else {
      prodModules.push(externalModule.external);
    }

    // Check if the module has any peer dependencies and include them too
    try {
      // find peer dependencies but remove optional ones and excluded ones
      const peerDependencies = modulePackage.peerDependencies as Record<string, string>;
      const optionalPeerDependencies = Object.keys(modulePackage.peerDependenciesMeta || {}).filter(
        key => {
          const val = modulePackage.peerDependenciesMeta?.[key];
          return val && val.optional;
        },
      );

      const peerDependenciesWithoutOptionals = omit(peerDependencies, [
        ...optionalPeerDependencies,
      ]);

      if (Object.keys(peerDependenciesWithoutOptionals).length > 0) {
        // eslint-disable-next-line no-console
        console.log(
          `Adding explicit non-optionals peers for dependency ${externalModule.external}`,
        );
        const peerModules = getProdModules(
          Object.keys(peerDependenciesWithoutOptionals).map(external => ({ external })),
          packageJsonPath,
          rootPackageJsonPath,
        );

        prodModules.push(...peerModules);
      }
    } catch (e) {
      // eslint-disable-next-line no-console
      console.warn(`WARNING: Could not check for peer dependencies of ${externalModule.external}`);
    }
  });

  return prodModules;
};

const addModulesToPackageJson = (
  externalModules: string[],
  packageJson: JSONObject,
  pathToPackageRoot: string,
) => {
  externalModules.forEach(externalModule => {
    const splitModule = externalModule.split('@');
    // If we have a scoped module we have to re-add the @
    if (externalModule.startsWith('@')) {
      splitModule.splice(0, 1);
      splitModule[0] = '@' + splitModule[0];
    }
    let moduleVersion = splitModule.splice(1, splitModule.length - 1).join('@');
    // We have to rebase file references to the target package.json
    moduleVersion = rebaseFileReferences(pathToPackageRoot, moduleVersion);
    packageJson.dependencies = packageJson.dependencies || {};
    packageJson.dependencies[splitModule[0]] = moduleVersion;
  });
};

const rebaseFileReferences = (pathToPackageRoot: string, moduleVersion: string) => {
  if (/^(?:file:[^/]{2}|\.\/|\.\.\/)/.test(moduleVersion)) {
    const filePath = moduleVersion.replace(/^file:/, '');
    return `${
      moduleVersion.startsWith('file:') ? 'file:' : ''
    }${pathToPackageRoot}/${filePath}`.replace(/\\/g, '/');
  }

  return moduleVersion;
};

const pick = <T extends Record<string | number | symbol, unknown>, K extends keyof T>(
  obj: T,
  keys: K[],
): {
  [K2 in keyof T]: T[K2];
} => {
  const ret = {} as {
    [K in keyof typeof obj]: typeof obj[K];
  };
  keys.forEach(key => {
    ret[key] = obj[key];
  });
  return ret;
};

const omit = <T extends Record<string | number | symbol, unknown>, K extends keyof T>(
  obj: T,
  keys: K[],
): {
  [K2 in Exclude<keyof T, K>]: T[K2];
} => {
  const ret = {} as {
    [K in keyof typeof obj]: typeof obj[K];
  };
  Object.keys(obj || {})
    .filter(key => !keys.includes(key as K))
    .forEach(key => {
      ret[key as K] = obj[key] as T[K];
    });
  return ret;
};
