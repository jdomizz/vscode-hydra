// Funciona en conjunto con osc.js

const { Client, Server } = require('node-osc');

// Usar el puerto 41234 para enviar mensajes a osc.js
const client = new Client('localhost', 41234);

// Usar la direccion '/test/node' para enviar valores aleatorios a osc.js
setInterval(() => {
    client.send('/test/node', [Math.random(), Math.random()]);
}, 1000);

// Usar el puerto 41235 para recibir mensajes de osc.js
const server = new Server(41235, 'localhost');

// Cerrar el servidor cuando reciba un mensaje (de osc.js)
server.on('message', (message) => {
    console.log(message);
    server.close();
});
