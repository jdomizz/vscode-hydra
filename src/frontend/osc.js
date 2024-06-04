import OSC from 'osc-js';

export class OSCService {

    constructor() {
        this.osc = new OSC();
        this.osc.open();
    }

    send(address, args) {
        this.osc.send(new OSC.Message(address, args));
    }

    on(address, callback) {
        this.osc.on(address, ({ args }) => {
            callback(args);
        });
    }
}
