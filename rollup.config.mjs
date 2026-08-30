import commonjs from '@rollup/plugin-commonjs';
import { nodeResolve } from '@rollup/plugin-node-resolve';
import typescript from '@rollup/plugin-typescript';

export default {
    input: 'src/frontend/main.ts',
    output: {
        file: 'out/frontend/main.js',
        format: 'es',
    },
    plugins: [
        typescript({
            tsconfig: './tsconfig.json',
            compilerOptions: {
                module: 'ES2022',
                moduleResolution: 'bundler',
            },
        }),
        nodeResolve({ browser: true, preferBuiltins: false }),
        commonjs()
    ]
};
