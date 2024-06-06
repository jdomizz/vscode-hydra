await loadScript("https://unpkg.com/tone")

document.body.onclick = () => {
    synth = new Tone.Synth().toDestination()
    synth.triggerAttackRelease("C4", "8n")
}