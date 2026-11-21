/** Testy e2e: każdy plik testowy dostaje własną bazę SQLite (zob. test/utils.ts). */
module.exports = {
  rootDir: '.',
  testEnvironment: 'node',
  testRegex: 'test/.*\\.e2e-spec\\.ts$',
  transform: {
    '^.+\\.ts$': ['ts-jest', { tsconfig: 'test/tsconfig.json' }],
  },
  moduleFileExtensions: ['ts', 'js', 'json'],
};
