import * as Utils from '../utils';
import { Yarn } from './yarn';

jest.mock('../utils', () => ({
  spawnProcess: jest.fn(),
  SpawnError: jest.requireActual('../utils').SpawnError,
}));

describe('yarn', () => {
  let packager: Yarn;

  beforeEach(() => {
    packager = new Yarn();
  });

  describe('getProdDependencies', () => {
    it('should use yarn list', async () => {
      (Utils.spawnProcess as jest.Mock).mockReturnValue({ stdout: '{}', stderr: '' });
      expect(packager.getProdDependencies('myPath', 1)).toMatchObject({
        dependencies: {},
        problems: [],
      });

      expect(Utils.spawnProcess as jest.Mock).toBeCalledWith(
        expect.stringMatching(/^yarn/),
        ['list', '--depth=1', '--json', '--production'],
        { cwd: 'myPath' },
      );
    });

    it('should transform yarn trees to npm dependencies', async () => {
      const testYarnResult =
        '{"type":"activityStart","data":{"id":0}}\n' +
        '{"type":"activityTick","data":{"id":0,"name":"bestzip@^2.1.5"}}\n' +
        '{"type":"activityTick","data":{"id":0,"name":"bluebird@^3.5.1"}}\n' +
        '{"type":"activityTick","data":{"id":0,"name":"fs-extra@^4.0.3"}}\n' +
        '{"type":"activityTick","data":{"id":0,"name":"mkdirp@^0.5.1"}}\n' +
        '{"type":"activityTick","data":{"id":0,"name":"minimist@^0.0.8"}}\n' +
        '{"type":"activityTick","data":{"id":0,"name":"@sls/webpack@^1.0.0"}}\n' +
        '{"type":"tree","data":{"type":"list","trees":[' +
        '{"name":"bestzip@2.1.5","children":[],"hint":null,"color":"bold",' +
        '"depth":0},{"name":"bluebird@3.5.1","children":[],"hint":null,"color":' +
        '"bold","depth":0},{"name":"fs-extra@4.0.3","children":[],"hint":null,' +
        '"color":"bold","depth":0},{"name":"mkdirp@0.5.1","children":[{"name":' +
        '"minimist@0.0.8","children":[],"hint":null,"color":"bold","depth":0}],' +
        '"hint":null,"color":null,"depth":0},{"name":"@sls/webpack@1.0.0",' +
        '"children":[],"hint":null,"color":"bold","depth":0}]}}\n';

      const expectedResult = {
        problems: [],
        dependencies: {
          bestzip: {
            version: '2.1.5',
            dependencies: {},
          },
          bluebird: {
            version: '3.5.1',
            dependencies: {},
          },
          'fs-extra': {
            version: '4.0.3',
            dependencies: {},
          },
          mkdirp: {
            version: '0.5.1',
            dependencies: {
              minimist: {
                version: '0.0.8',
                dependencies: {},
              },
            },
          },
          '@sls/webpack': {
            version: '1.0.0',
            dependencies: {},
          },
        },
      };

      (Utils.spawnProcess as jest.Mock).mockReturnValue({ stdout: testYarnResult, stderr: '' });

      expect(packager.getProdDependencies('myPath', 1)).toStrictEqual(expectedResult);
    });

    it('should reject on critical yarn errors', async () => {
      (Utils.spawnProcess as jest.Mock).mockImplementation(() => {
        throw new Utils.SpawnError(
          'Exited with code 1',
          '',
          'Yarn failed.\nerror Could not find module.',
        );
      });

      expect(() => packager.getProdDependencies('myPath', 1)).toThrowError('Exited with code 1');
    });
  });

  describe('rebaseLockfile', () => {
    it('should return the original lockfile', () => {
      const testContent = 'eugfogfoigqwoeifgoqwhhacvaisvciuviwefvc';
      const testContent2 = 'eugfogfoigqwoeifgoqwhhacvaisvciuviwefvc';
      expect(packager.rebaseLockfile('.', testContent)).toEqual(testContent2);
    });

    it('should rebase file references', () => {
      const testContent = `
      acorn@^2.1.0, acorn@^2.4.0:
        version "2.7.0"
        resolved "https://registry.yarnpkg.com/acorn/-/acorn-2.7.0.tgz#ab6e7d9d886aaca8b085bc3312b79a198433f0e7"
      acorn@^3.0.4:
        version "3.3.0"
        resolved "https://registry.yarnpkg.com/acorn/-/acorn-3.3.0.tgz#45e37fb39e8da3f25baee3ff5369e2bb5f22017a"
      otherModule@file:../../otherModule/the-new-version:
        version "1.2.0"
      acorn@^2.1.0, acorn@^2.4.0:
        version "2.7.0"
        resolved "https://registry.yarnpkg.com/acorn/-/acorn-2.7.0.tgz#ab6e7d9d886aaca8b085bc3312b79a198433f0e7"
      "@myCompany/myModule@../../myModule/the-new-version":
        version "6.1.0"
        dependencies:
          aws-xray-sdk "^1.1.6"
          aws4 "^1.6.0"
          base-x "^3.0.3"
          bluebird "^3.5.1"
          chalk "^1.1.3"
          cls-bluebird "^2.1.0"
          continuation-local-storage "^3.2.1"
          lodash "^4.17.4"
          moment "^2.20.0"
          redis "^2.8.0"
          request "^2.83.0"
          ulid "^0.1.0"
          uuid "^3.1.0"
        acorn@^5.0.0, acorn@^5.5.0:
          version "5.5.3"
          resolved "https://registry.yarnpkg.com/acorn/-/acorn-5.5.3.tgz#f473dd47e0277a08e28e9bec5aeeb04751f0b8c9"
      `;

      const expectedContent = `
      acorn@^2.1.0, acorn@^2.4.0:
        version "2.7.0"
        resolved "https://registry.yarnpkg.com/acorn/-/acorn-2.7.0.tgz#ab6e7d9d886aaca8b085bc3312b79a198433f0e7"
      acorn@^3.0.4:
        version "3.3.0"
        resolved "https://registry.yarnpkg.com/acorn/-/acorn-3.3.0.tgz#45e37fb39e8da3f25baee3ff5369e2bb5f22017a"
      otherModule@file:../../project/../../otherModule/the-new-version:
        version "1.2.0"
      acorn@^2.1.0, acorn@^2.4.0:
        version "2.7.0"
        resolved "https://registry.yarnpkg.com/acorn/-/acorn-2.7.0.tgz#ab6e7d9d886aaca8b085bc3312b79a198433f0e7"
      "@myCompany/myModule@../../project/../../myModule/the-new-version":
        version "6.1.0"
        dependencies:
          aws-xray-sdk "^1.1.6"
          aws4 "^1.6.0"
          base-x "^3.0.3"
          bluebird "^3.5.1"
          chalk "^1.1.3"
          cls-bluebird "^2.1.0"
          continuation-local-storage "^3.2.1"
          lodash "^4.17.4"
          moment "^2.20.0"
          redis "^2.8.0"
          request "^2.83.0"
          ulid "^0.1.0"
          uuid "^3.1.0"
        acorn@^5.0.0, acorn@^5.5.0:
          version "5.5.3"
          resolved "https://registry.yarnpkg.com/acorn/-/acorn-5.5.3.tgz#f473dd47e0277a08e28e9bec5aeeb04751f0b8c9"
      `;

      expect(packager.rebaseLockfile('../../project', testContent)).toBe(expectedContent);
    });
  });
});
