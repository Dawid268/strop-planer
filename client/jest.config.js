const { pathsToModuleNameMapper } = require("ts-jest");

module.exports = {
  preset: "jest-preset-angular",
  setupFilesAfterEnv: ["<rootDir>/setup-jest.ts"],
  testEnvironment: "jest-environment-jsdom",
  testPathIgnorePatterns: ["<rootDir>/node_modules/", "<rootDir>/dist/"],
  moduleNameMapper: {
    "^@app/(.*)$": "<rootDir>/src/app/$1",
    "^@core/(.*)$": "<rootDir>/src/app/core/$1",
    "^@features/(.*)$": "<rootDir>/src/app/features/$1",
    "^@shared/(.*)$": "<rootDir>/src/app/shared/$1",
    "^@env/(.*)$": "<rootDir>/src/environments/$1",
    "^@models/(.*)$": "<rootDir>/src/app/models/$1",
    "^@state/(.*)$": "<rootDir>/src/app/state/$1",
  },
};
