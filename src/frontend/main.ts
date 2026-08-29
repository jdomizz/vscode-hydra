import { HydraService } from './hydra';
import { OSCService } from './osc';
import { P5 } from './p5';

declare function acquireVsCodeApi(): {
    postMessage(message: { type: string; value?: any }): void;
};

const vscode = acquireVsCodeApi();

const hydra = new HydraService(vscode);

const osc = new OSCService();
osc.open();

(window as any).OSC = osc;

(window as any).P5 = P5;

window.addEventListener('message', (event) => {
    switch (event.data.type) {
        case 'createHydra': return hydra.createHydra(event.data.value);
        case 'evalCode': return hydra.evalCode(event.data.value);
        case 'captureImage': return hydra.captureImage();
        case 'startRecorder': return hydra.startRecorder();
        case 'stopRecorder': return hydra.stopRecorder();
    }
});

window.onunhandledrejection = (event: PromiseRejectionEvent) => {
    vscode.postMessage({ type: 'error', value: `${event.reason}` });
};

window.onbeforeunload = () => {
    osc.close();
};
