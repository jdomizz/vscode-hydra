import OSC from 'osc-js';

export function openOscBridge() {
    new OSC({
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
    }).open();
}
