import Hydra from 'hydra-synth';
import { createCanvas } from './canvas';

const canvas = createCanvas({});
const hydra = new Hydra({ canvas, detectAudio: false });

window.addEventListener('message', (event) => {
    const { value } = event.data;

    hydra.sandbox.eval(`(async () => { ${value} })()`);
});
