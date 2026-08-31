import { defineConfig } from 'vitest/config';
import path from 'node:path';

export default defineConfig({
    resolve: {
        alias: {
            vscode: path.resolve(__dirname, 'src/__mocks__/vscode.ts'),
        },
    },
    test: {
        include: ['src/**/*.spec.ts'],
        environment: 'node',
        passWithNoTests: true,
        globalSetup: ['./test-setup.ts'],
    },
});
