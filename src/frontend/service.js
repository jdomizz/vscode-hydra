import Hydra from 'hydra-synth';
import { createCanvas } from './canvas';
import { VideoRecorder } from './recorder';

export class HydraService {

    constructor(vscode) {
        this.vscode = vscode;
    }

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
            this.vscode.postMessage({ type: 'status', value: 'recording' });
        }
    }

    stopRecorder() {
        if (this.hydra) {
            this.hydra.synth.vidRecorder.stop();
            this.vscode.postMessage({ type: 'status', value: 'rendering' });
        }
    }
}