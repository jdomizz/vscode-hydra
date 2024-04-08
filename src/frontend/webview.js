import Hydra from 'hydra-synth';
import { createCanvas } from './canvas';

const canvas = createCanvas({});
const hydra = new Hydra({ canvas, detectAudio: false });
const vscode = acquireVsCodeApi();

hydra.canvasToImage = () => {
    canvas.toBlob((blob) => {
        const url = window.URL.createObjectURL(blob);
        const name = `hydra-${new Date().toISOString()}`;
        const extension = 'png';
        const a = document.createElement('a');
        a.href = url;
        a.download = `${name}.${extension}`;
        a.click();
        setTimeout(() => window.URL.revokeObjectURL(url), 1000 * 60);
    }, `image/png`);
};

window.addEventListener('message', (event) => {
    const { type, value } = event.data;

    switch (type) {
        case 'eval': return hydra.sandbox.eval(`(async () => { ${value} })()`);
        case 'image': return hydra.synth.screencap();
    }
});

window.onunhandledrejection = (event) => {
    vscode.postMessage({ type: 'error', value: `${event.reason}` });
};