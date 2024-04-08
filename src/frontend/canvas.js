export function createCanvas({ width, height }) {

    const actualWidth = width ?? window.innerWidth * 2;
    const actualHeight = height ?? window.innerHeight * 2;

    const canvas = document.createElement('canvas');

    canvas.id = 'hydra-canvas';
    canvas.width = actualWidth;
    canvas.height = actualHeight;
    canvas.style.position = 'fixed';
    canvas.style.top = '0';
    canvas.style.left = '0';
    canvas.style.width = '100%';
    canvas.style.height = '100%';

    document.body.appendChild(canvas);

    let timeout;
    window.addEventListener('resize', () => {
        timeout && clearTimeout(timeout);
        timeout = setTimeout(() => {
            canvas.width = actualWidth;
            canvas.height = actualHeight;
        }, 200);
    });

    return canvas;
}

