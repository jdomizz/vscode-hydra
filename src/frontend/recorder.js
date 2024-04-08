// Adapted from https://github.com/hydra-synth/hydra-synth/blob/main/src/lib/video-recorder.js

export class VideoRecorder {

    options = [
        { mimeType: 'video/webm;codecs=vp9' },
        { mimeType: 'video/webm,codecs=vp9' },
        'video/vp8' // Chrome 47
    ];

    constructor(canvas) {
        this.canvas = canvas;
        this.stream = this.canvas.captureStream(25);
        this.mediaSource = new MediaSource();
    }

    start() {
        this.recordedBlobs = [];
        this._initRecorder();
        this.mediaRecorder.onstop = () => this._stopRecording();
        this.mediaRecorder.ondataavailable = (event) => this._startRecording(event);
        this.mediaRecorder.start(100); // collect 100 ms of data
    }

    stop() {
        this.mediaRecorder.stop();
    }

    capture() {
        this.canvas.toBlob((blob) => {
            const url = window.URL.createObjectURL(blob);
            const name = `hydra-${new Date().toISOString()}`;
            downloadFile({ url, name, extension: 'png' });
        }, `image/png`);
    }

    _initRecorder() {
        this.options.forEach((option) => {
            if (!this.mediaRecorder && this.stream) {
                try {
                    this.mediaRecorder = new MediaRecorder(this.stream, option);
                } catch (e) {
                    console.log(e);
                }
            }
        });
    }

    _startRecording(event) {
        if (event.data && event.data.size > 0) {
            this.recordedBlobs.push(event.data);
        }
    }

    _stopRecording() {
        const blob = new Blob(this.recordedBlobs, { type: this.mediaRecorder.mimeType });
        const url = window.URL.createObjectURL(blob);
        const name = `hydra-${new Date().toISOString()}`;
        downloadFile({ url, name, extension: 'webm' });
    }
}

function downloadFile({ url, name, extension }) {
    const a = document.createElement('a');
    a.href = url;
    a.download = `${name}.${extension}`;
    a.click();
    setTimeout(() => window.URL.revokeObjectURL(url), 1000 * 60);
}
