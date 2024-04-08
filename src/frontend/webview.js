import Hydra from 'hydra-synth';
import { createCanvas } from './canvas';

const canvas = createCanvas({});
const hydra = new Hydra({ canvas, detectAudio: false });
const vscode = acquireVsCodeApi();

window.addEventListener('message', (event) => {
    const { type, value } = event.data;

    switch (type) {
        case 'eval': return hydra.sandbox.eval(`(async () => { ${value} })()`);
    }
});

window.onunhandledrejection = (event) => {
    vscode.postMessage({ type: 'error', value: `${event.reason}` });
};