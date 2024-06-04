const { Client, Server } = require('node-osc');

const client = new Client('localhost', 41234);

setInterval(() => {
    client.send('/test/node', [Math.random(), Math.random()]);
}, 1000);

const server = new Server(41235, 'localhost');

server.on('message', (message) => {
    console.log(`node received`, message);
    server.close();
});
