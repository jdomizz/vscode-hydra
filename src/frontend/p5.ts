// Taken from https://github.com/hydra-synth/hydra/blob/main/src/lib/p5-wrapper.js

import p5 from 'p5';

interface P5Config {
    width?: number;
    height?: number;
    mode?: 'P2D' | 'WEBGL';
}

export class P5 extends p5 {

    width: number;
    height: number;
    mode: string;

    constructor({
        width = window.innerWidth,
        height = window.innerHeight,
        mode = 'P2D'
    }: P5Config = {}) {

        super((p: any) => {
            p.setup = () => { p.createCanvas(width, height, p[mode]); };
            p.draw = () => { };
        });

        this.width = width;
        this.height = height;
        this.mode = mode;
        (this as any).canvas.style.position = "absolute";
        (this as any).canvas.style.top = "0px";
        (this as any).canvas.style.left = "0px";
        (this as any).canvas.style.zIndex = "-1";
    }

    show(): void {
        (this as any).canvas.style.visibility = "visible";
    }

    hide(): void {
        (this as any).canvas.style.visibility = "hidden";
    }

    clearCanvas(): void {
        const ctx = (this as any).drawingContext as CanvasRenderingContext2D;
        ctx.clearRect(0, 0, (this as any).canvas.width, (this as any).canvas.height);
    }
}
