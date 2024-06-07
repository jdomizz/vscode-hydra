await loadScript("https://unpkg.com/tone");

// To start the audio context, a user action is required
document.body.onclick = () => {
    synth = new Tone.Synth().toDestination();
    synth.triggerAttackRelease("C4", "8n");
};