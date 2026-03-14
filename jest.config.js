module.exports = {
  testEnvironment: "jsdom",
  setupFilesAfterEnv: ["@testing-library/jest-dom"], // Ensure this line is in place
  transform: {
    "^.+\\.[t|j]sx?$": "babel-jest", // Transform .js, .jsx, .ts, .tsx using babel-jest
  },
  moduleFileExtensions: ["js", "jsx", "ts", "tsx"],
  testPathIgnorePatterns: ["/node_modules/", "/.next/"],
  collectCoverageFrom: ["src/**/*.{js,jsx,ts,tsx}", "!src/**/*.d.ts"],
  moduleNameMapper: {
    "^@/(.*)$": "<rootDir>/src/$1", // Resolves @ to the src folder
  },
  setupFiles: ["<rootDir>/jest.setup.js"],
};
