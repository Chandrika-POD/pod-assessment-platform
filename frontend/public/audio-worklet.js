class Pcm16Capture extends AudioWorkletProcessor {
  constructor() {
    super();
    this.source = [];
    this.next = 0;
    this.step = sampleRate / 16000;
    this.output = new Int16Array(1600);
    this.outputLength = 0;
  }

  process(inputs, outputs) {
    const input = inputs[0]?.[0];
    if (input) {
      for (const sample of input) this.source.push(sample);
      while (this.next + 1 < this.source.length) {
        const start = Math.floor(this.next);
        const fraction = this.next - start;
        const value =
          this.source[start] * (1 - fraction) +
          this.source[start + 1] * fraction;
        this.output[this.outputLength++] = Math.round(
          Math.max(-1, Math.min(1, value)) * 32767,
        );
        this.next += this.step;
        if (this.outputLength === this.output.length) {
          this.port.postMessage(this.output.buffer, [this.output.buffer]);
          this.output = new Int16Array(1600);
          this.outputLength = 0;
        }
      }
      const consumed = Math.floor(this.next);
      if (consumed) {
        this.source.splice(0, consumed);
        this.next -= consumed;
      }
    }
    for (const output of outputs) for (const channel of output) channel.fill(0);
    return true;
  }
}
registerProcessor('pcm16-capture', Pcm16Capture);
