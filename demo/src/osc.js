// Intended to communicate with 'osc-node.js'

let freq = 10;
let rot = 0.2;

// Listen to messages from 'osc-node.js'
OSC.on('/test/node', (args) => {
    freq = args[0];
    rot = args[1] / 10;
});

osc(() => freq)
    .mult(osc().rotate(() => rot))
    .out();

// Send a message to 'osc-node.js'
// OSC.send('/test/webview', Math.random());
