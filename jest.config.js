module.exports = {
  testEnvironment: "jsdom", // For simulating browser environment
  setupFilesAfterEnv: [
    "@testing-library/jest-dom", // Custom matchers for testing
    "<rootDir>/jest.setup.js", // Your jest setup file with global mocks/polyfills
  ],
  transform: {
    "^.+\\.[t|j]sx?$": "babel-jest", // Transform .js, .jsx, .ts, .tsx using babel-jest
  },
  moduleFileExtensions: ["js", "jsx", "ts", "tsx"], // Extensions to be handled by Jest
  testPathIgnorePatterns: ["/node_modules/", "/.next/"], // Ignore unnecessary paths
  collectCoverageFrom: [
    "src/**/*.{js,jsx,ts,tsx}",
    "!src/**/*.d.ts", // Ignore TypeScript declaration files
  ],
  moduleNameMapper: {
    "^@/(.*)$": "<rootDir>/src/$1", // Resolves @ to the src folder (path alias)
  },
  setupFiles: ["<rootDir>/jest.setup.js"], // If you want to add additional setup files
};
