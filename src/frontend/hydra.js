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
        this._loadScripts(configuration);
        this.vscode.postMessage({ type: 'status', value: 'rendering' });
        this.vscode.postMessage({ type: 'start', value: true });
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

    _loadScripts(configuration) {
        window._hydra = this.hydra;
        if (configuration.loadScripts) {
            configuration.loadScripts.forEach((uri) => {
                this.evalCode(`await loadScript('${uri}')`);
            });
        }
    }
}