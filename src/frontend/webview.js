import Hydra from 'hydra-synth';
import { createCanvas } from './canvas';
import { VideoRecorder } from './recorder';

const vscode = acquireVsCodeApi();

class HydraService {

    createHydra(configuration) {
        this.canvas = createCanvas(configuration);
        this.hydra = new Hydra({ canvas: this.canvas, detectAudio: false });
        this.hydra.synth.vidRecorder = new VideoRecorder(this.canvas);
        this.hydra.canvasToImage = this.hydra.synth.vidRecorder.capture;
    }

    evalCode(code) {
        if (this.hydra) {
            this.hydra.sandbox.eval(`(async () => { ${code} })()`);
        }
    }

    captureImage() {
        if (this.hydra) {
            this.hydra.synth.screencap();
        }
    }

    startRecorder() {
        if (this.hydra) {
            this.hydra.synth.vidRecorder.start();
            vscode.postMessage({ type: 'status', value: 'recording' });
        }
    }

    stopRecorder() {
        if (this.hydra) {
            this.hydra.synth.vidRecorder.stop();
            vscode.postMessage({ type: 'status', value: 'rendering' });
        }
    }
}

const service = new HydraService();

window.addEventListener('message', (event) => {
    switch (event.data.type) {
        case 'createHydra': return service.createHydra(event.data.value);
        case 'evalCode': return service.evalCode(event.data.value);
        case 'captureImage': return service.captureImage();
        case 'startRecorder': return service.startRecorder();
        case 'stopRecorder': return service.stopRecorder();
    }
});

window.onunhandledrejection = (event) => {
    vscode.postMessage({ type: 'error', value: `${event.reason}` });
};