module.exports = {
  testEnvironment: "node",
  testMatch: ["**/tests/**/*.test.js"],
  setupFiles: ["./tests/setup-env.js"],
  maxWorkers: 1,
  verbose: true,
  forceExit: true,
};
