import { defineConfig } from 'vitest/config';

// Plain Node tests for the pure logic. They read the shared fixtures in ../../schema/fixtures.
export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
  },
});
