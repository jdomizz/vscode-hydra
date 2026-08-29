import OSC from 'osc-js';

export class OSCService {

    private osc: OSC;

    constructor() {
        this.osc = new OSC();
    }

    open(options?: any): void {
        this.osc.open(options);
    }

    send(address: string, args: any): void {
        this.osc.send(new OSC.Message(address, args));
    }

    on(address: string, callback: (args: any) => void): void {
        this.osc.on(address, ({ args }: any) => {
            callback(args);
        });
    }

    off(address: string, callback: (args: any) => void): void {
        this.osc.on(address, ({ args }: any) => {
            callback(args);
        });
    }

    close(): void {
        this.osc.close();
    }
}
