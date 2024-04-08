import Hydra from 'hydra-synth';

const hydra = new Hydra({ detectAudio: false });

window.addEventListener('message', (event) => {
    const { value } = event.data;

    hydra.sandbox.eval(`(async () => { ${value} })()`);
});
