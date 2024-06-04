// https://github.com/hydra-synth/hydra/blob/main/src/lib/p5-wrapper.js

import p5 from 'p5';

export default class P5 extends p5 {

    constructor({
        width = window.innerWidth,
        height = window.innerHeight,
        mode = 'P2D'
    } = {}) {

        super((p) => {
            p.setup = () => { p.createCanvas(width, height, p[mode]); };
            p.draw = () => { };
        });

        this.width = width;
        this.height = height;
        this.mode = mode;
        this.canvas.style.position = "absolute";
        this.canvas.style.top = "0px";
        this.canvas.style.left = "0px";
        this.canvas.style.zIndex = -1;
    }

    show() {
        this.canvas.style.visibility = "visible";
    }

    hide() {
        this.canvas.style.visibility = "hidden";
    }

    clear() {
        this.drawingContext.clearRect(0, 0, this.canvas.width, this.canvas.height);
    }
}
