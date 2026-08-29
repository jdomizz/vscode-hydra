import Hydra from 'hydra-synth';
import { createCanvas } from './canvas';
import { VideoRecorder } from './recorder';

interface Configuration {
    width?: number;
    height?: number;
    loadScripts?: string[];
}

interface VSCodeApi {
    postMessage(message: { type: string; value?: any }): void;
}

export class HydraService {

    private vscode: VSCodeApi;
    private canvas?: HTMLCanvasElement;
    private hydra?: Hydra;

    constructor(vscode: VSCodeApi) {
        this.vscode = vscode;
    }

    createHydra(configuration: Configuration): void {
        this.canvas = createCanvas(configuration);
        this.hydra = new Hydra({ canvas: this.canvas, detectAudio: false });
        (this.hydra.synth as any).vidRecorder = new VideoRecorder(this.canvas);
        (this.hydra as any).canvasToImage = (this.hydra.synth as any).vidRecorder.capture;
        this._loadScripts(configuration);
        this.vscode.postMessage({ type: 'status', value: 'rendering' });
        this.vscode.postMessage({ type: 'start', value: true });
    }

    evalCode(code: string): void {
        if (this.hydra) {
            this.hydra.sandbox.eval(`(async () => { ${code} })()`);
        }
    }

    captureImage(): void {
        if (this.hydra) {
            this.hydra.synth.screencap();
        }
    }

    startRecorder(): void {
        if (this.hydra) {
            (this.hydra.synth as any).vidRecorder.start();
            this.vscode.postMessage({ type: 'status', value: 'recording' });
        }
    }

    stopRecorder(): void {
        if (this.hydra) {
            (this.hydra.synth as any).vidRecorder.stop();
            this.vscode.postMessage({ type: 'status', value: 'rendering' });
        }
    }

    private _loadScripts(configuration: Configuration): void {
        (window as any)._hydra = this.hydra;
        if (configuration.loadScripts) {
            configuration.loadScripts.forEach((uri) => {
                this.evalCode(`await loadScript('${uri}')`);
            });
        }
    }
}
