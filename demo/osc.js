let freq = 10;
let rot = 0.2;

msg.on('/test/node', (args) => {
    freq = args[0];
    rot = args[1] / 10;
});

osc(() => freq)
    .mult(osc().rotate(() => rot))
    .out();

// msg.send('/test/webview', Math.random());
