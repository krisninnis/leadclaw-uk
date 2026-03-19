module.exports = {
  testEnvironment: "node",
  clearMocks: true,
  testPathIgnorePatterns: ["/node_modules/", "/.next/"],
  collectCoverageFrom: ["src/**/*.{js,jsx,ts,tsx}", "!src/**/*.d.ts"],
  moduleNameMapper: {
    "^@/(.*)$": "<rootDir>/src/$1",
  },
  transform: {
    "^.+\\.[tj]sx?$": "babel-jest",
  },
  setupFiles: ["<rootDir>/jest.setup.js"],
};
