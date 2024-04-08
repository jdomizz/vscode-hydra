import Hydra from 'hydra-synth';
import { createCanvas } from './canvas';
import { VideoRecorder } from './recorder';

const vscode = acquireVsCodeApi();

const canvas = createCanvas({});
const recorder = new VideoRecorder(canvas);
const hydra = new Hydra({ canvas, detectAudio: false });
hydra.synth.vidRecorder = recorder;
hydra.canvasToImage = recorder.capture;

const evalCode = (code) => {
    hydra.sandbox.eval(`(async () => { ${code} })()`);
};

const captureImage = () => {
    hydra.synth.screencap();
};

const startRecorder = () => {
    hydra.synth.vidRecorder.start();
    vscode.postMessage({ type: 'status', value: 'recording' });
};

const stopRecorder = () => {
    hydra.synth.vidRecorder.stop();
    vscode.postMessage({ type: 'status', value: 'rendering' });
};

window.addEventListener('message', (event) => {
    const { type, value } = event.data;

    switch (type) {
        case 'evalCode': return evalCode(value);
        case 'captureImage': return captureImage();
        case 'startRecorder': return startRecorder();
        case 'stopRecorder': return stopRecorder();
    }
});

window.onunhandledrejection = (event) => {
    vscode.postMessage({ type: 'error', value: `${event.reason}` });
};