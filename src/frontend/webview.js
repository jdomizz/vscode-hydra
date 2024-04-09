import { HydraService } from './service';

const service = new HydraService(acquireVsCodeApi());

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