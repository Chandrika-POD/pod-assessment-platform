// Raw PCM transport: 16 kHz input, 24 kHz Gemini output. No audio is retained.
export class LiveAudio {
  constructor(onAudio) {
    this.onAudio = onAudio;
    this.context = new AudioContext();
    this.stream = null;
    this.capture = null;
    this.source = null;
    this.nodes = new Set();
    this.nextAt = 0;
    this.closed = false;
    this.enabled = true;
  }
  async start() {
    await this.context.resume();
    if (!navigator.mediaDevices?.getUserMedia)
      throw new Error(
        'Microphone access requires localhost or HTTPS. You can still type your answers.',
      );
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: { echoCancellation: true, noiseSuppression: true },
      video: false,
    });
    if (this.closed) {
      stream.getTracks().forEach((track) => track.stop());
      return;
    }
    this.stream = stream;
    await this.context.audioWorklet.addModule('/audio-worklet.js');
    if (this.closed) return;
    this.source = this.context.createMediaStreamSource(stream);
    this.capture = new AudioWorkletNode(this.context, 'pcm16-capture');
    this.capture.port.onmessage = (event) => {
      if (!this.closed && this.enabled) this.onAudio(event.data);
    };
    this.source.connect(this.capture);
    this.capture.connect(this.context.destination);
  }
  play(base64) {
    if (this.closed || this.context.state !== 'running') return;
    const bytes = Uint8Array.from(atob(base64), (char) => char.charCodeAt(0));
    if (bytes.length % 2) return;
    const pcm = new DataView(bytes.buffer);
    const buffer = this.context.createBuffer(1, bytes.length / 2, 24000);
    const channel = buffer.getChannelData(0);
    for (let i = 0; i < channel.length; i++)
      channel[i] = pcm.getInt16(i * 2, true) / 32768;
    if (this.nextAt > this.context.currentTime + 30) this.interrupt();
    const node = this.context.createBufferSource();
    node.buffer = buffer;
    node.connect(this.context.destination);
    this.nodes.add(node);
    node.onended = () => {
      node.disconnect();
      this.nodes.delete(node);
    };
    this.nextAt = Math.max(this.nextAt, this.context.currentTime + 0.04);
    node.start(this.nextAt);
    this.nextAt += buffer.duration;
  }
  mute(value) {
    this.enabled = !value;
    this.stream?.getAudioTracks().forEach((track) => {
      track.enabled = !value;
    });
  }
  interrupt() {
    for (const node of this.nodes) {
      node.stop();
      node.disconnect();
    }
    this.nodes.clear();
    this.nextAt = 0;
  }
  close() {
    this.closed = true;
    this.stream?.getTracks().forEach((track) => track.stop());
    this.capture?.disconnect();
    this.source?.disconnect();
    this.interrupt();
    this.context.close().catch(() => {});
  }
}
