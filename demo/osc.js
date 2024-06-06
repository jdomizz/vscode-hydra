// Funciona en conjunto con osc-node.js

let freq = 10;
let rot = 0.2;

// Escuchar los mensajes de osc-node.js
msg.on('/test/node', (args) => {
    freq = args[0];
    rot = args[1] / 10;
});

osc(() => freq)
    .mult(osc().rotate(() => rot))
    .out();

// Enviar un mensaje a osc-node.js
setTimeout(() => {
    msg.send('/test/webview', Math.random());
}, 60 * 1000);
