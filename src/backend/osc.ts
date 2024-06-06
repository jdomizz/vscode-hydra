import OSC from 'osc-js';

export class OSCService {

    private readonly osc: OSC;

    constructor() {
        this.osc = new OSC({
            plugin: new OSC.BridgePlugin({
                receiver: 'ws',
                udpServer: {
                    host: 'localhost',
                    port: 41234,
                    exclusive: false
                },
                udpClient: {
                    host: 'localhost',
                    port: 41235
                },
                wsServer: {
                    host: 'localhost',
                    port: 8080
                }
            })
        });

    }

    open() {
        this.osc.open();
    }

    close() {
        this.osc.close();
    }
}