import commonjs from '@rollup/plugin-commonjs';
import { nodeResolve } from '@rollup/plugin-node-resolve';
import typescript from '@rollup/plugin-typescript';

export default {
    input: 'src/runtime/main.ts',
    output: {
        file: 'out/runtime/main.js',
        format: 'es',
        sourcemap: true,
    },
    plugins: [
        typescript({
            tsconfig: './tsconfig.json',
            compilerOptions: {
                module: 'ES2022',
                moduleResolution: 'bundler',
                declaration: false,
                rootDir: '..',
            },
        }),
        nodeResolve({
            browser: true,
            preferBuiltins: false,
            extensions: ['.ts', '.js', '.mjs'],
        }),
        commonjs(),
    ],
};
