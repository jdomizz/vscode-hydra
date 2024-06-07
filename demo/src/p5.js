// Initialize a new p5 instance It is only necessary to call this once
p5 = new P5() // {width: window.innerWidth, height:window.innerHeight, mode: 'P2D'}

// draw a rectangle at point 300, 100
p5.rect(300, 100, 100, 100)

// Note that P5 runs in instance mode, so all functions need to start with the variable where P5 was initialized (in this case p5)
// reference for P5: https://P5js.org/reference/
// explanation of instance mode: https://github.com/processing/P5.js/wiki/Global-and-instance-mode


p5.clear()

for (var i = 0; i < 100; i++) {
    p5.fill(i * 10, i % 30, 255)
    p5.rect(i * 20, 200, 10, 200)
}

// To live code animations, you can redefine the draw function of P5 as follows:
// (a rectangle that follows the mouse)
p5.draw = () => {
    p5.fill(p5.mouseX / 5, p5.mouseY / 5, 255, 100)
    p5.rect(p5.mouseX, p5.mouseY, 30, 150)
}

// To use P5 as an input to hydra, simply use the canvas as a source:
s0.init({ src: p5.canvas })

// Then render the canvas
src(s0).repeat().out()