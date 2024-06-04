import { OSCService } from './osc';
import P5 from './p5';
import { HydraService } from './service';

const vscode = acquireVsCodeApi();

const service = new HydraService(vscode);

window.msg = new OSCService();

window.P5 = P5;

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