// Intended to communicate with 'osc.js'

const { Client, Server } = require('node-osc');

// Use port 41234 to send messages to 'osc.js'
const client = new Client('localhost', 41234);

// Use the address '/test/node' to send random values to 'osc.js'
setInterval(() => {
    client.send('/test/node', [Math.random(), Math.random()]);
}, 1000);

// Use port 41235 to receive messages from 'osc.js'
const server = new Server(41235, 'localhost');

// Listening to 'osc.js' messages
server.on('message', (message) => {
    console.log(message);
});
