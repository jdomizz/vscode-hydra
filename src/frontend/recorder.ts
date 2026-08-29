// Adapted from https://github.com/hydra-synth/hydra-synth/blob/main/src/lib/video-recorder.js

export class VideoRecorder {

    options: Array<string | { mimeType: string }> = [
        { mimeType: 'video/webm;codecs=vp9' },
        { mimeType: 'video/webm,codecs=vp9' },
        'video/vp8' // Chrome 47
    ];

    private canvas: HTMLCanvasElement;
    private stream: MediaStream;
    private mediaSource: MediaSource;
    private recordedBlobs: Blob[] = [];
    private mediaRecorder!: MediaRecorder;

    constructor(canvas: HTMLCanvasElement) {
        this.canvas = canvas;
        this.stream = this.canvas.captureStream(25);
        this.mediaSource = new MediaSource();
    }

    start(): void {
        this.recordedBlobs = [];
        this._initRecorder();
        this.mediaRecorder.onstop = () => this._stopRecording();
        this.mediaRecorder.ondataavailable = (event: BlobEvent) => this._startRecording(event);
        this.mediaRecorder.start(100); // collect 100 ms of data
    }

    stop(): void {
        this.mediaRecorder.stop();
    }

    capture(): void {
        this.canvas.toBlob((blob) => {
            if (blob) {
                const url = window.URL.createObjectURL(blob);
                const name = `hydra-${new Date().toISOString()}`;
                downloadFile({ url, name, extension: 'png' });
            }
        }, `image/png`);
    }

    private _initRecorder(): void {
        this.options.forEach((option) => {
            if (!this.mediaRecorder && this.stream) {
                try {
                    this.mediaRecorder = new MediaRecorder(this.stream, option as MediaRecorderOptions);
                } catch (e) {
                    console.log(e);
                }
            }
        });
    }

    private _startRecording(event: BlobEvent): void {
        if (event.data && event.data.size > 0) {
            this.recordedBlobs.push(event.data);
        }
    }

    private _stopRecording(): void {
        const blob = new Blob(this.recordedBlobs, { type: this.mediaRecorder.mimeType });
        const url = window.URL.createObjectURL(blob);
        const name = `hydra-${new Date().toISOString()}`;
        downloadFile({ url, name, extension: 'webm' });
    }
}

interface MediaRecorderOptions {
    mimeType?: string;
}

function downloadFile({ url, name, extension }: { url: string; name: string; extension: string }): void {
    const a = document.createElement('a');
    a.href = url;
    a.download = `${name}.${extension}`;
    a.click();
    setTimeout(() => window.URL.revokeObjectURL(url), 1000 * 60);
}
