import { Packager } from './types';
// import { NPM } from './npm';
// import { Pnpm } from './pnpm';
import { Yarn } from './yarn';
const registeredPackagers: Record<string, Packager> = {
  //   npm: new NPM(),
  //   pnpm: new Pnpm(),
  yarn: new Yarn(),
};

export const get = (packagerId: string): Packager => {
  const packager = registeredPackagers[packagerId] || null;
  if (!packager) {
    const message = `Could not find packager '${packagerId}'`;
    throw Error(message);
  }
  return packager;
};
