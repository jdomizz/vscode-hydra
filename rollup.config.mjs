import commonjs from '@rollup/plugin-commonjs';
import { nodeResolve } from '@rollup/plugin-node-resolve';

export default {
    input: 'src/frontend/main.js',
    output: {
        file: 'out/frontend/main.js',
        format: 'es',
    },
    plugins: [
        nodeResolve({ browser: true, preferBuiltins: false }),
        commonjs()
    ]
};