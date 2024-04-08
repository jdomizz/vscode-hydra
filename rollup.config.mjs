import { nodeResolve } from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';

export default {
    input: 'src/frontend/webview.js',
    output: {
        file: 'out/frontend/webview.js',
        format: 'es',
    },
    plugins: [
        nodeResolve({ browser: true, preferBuiltins: false }),
        commonjs()
    ]
};