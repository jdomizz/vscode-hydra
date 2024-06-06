import OSC from 'osc-js';

export class OSCService {

    constructor() {
        this.osc = new OSC();
    }

    open(options) {
        this.osc.open(options);
    }

    send(address, args) {
        this.osc.send(new OSC.Message(address, args));
    }

    on(address, callback) {
        this.osc.on(address, ({ args }) => {
            callback(args);
        });
    }

    off(address, callback) {
        this.osc.on(address, ({ args }) => {
            callback(args);
        });
    }

    close() {
        this.osc.close();
    }
}
