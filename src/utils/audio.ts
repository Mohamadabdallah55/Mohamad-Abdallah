/**
 * Web Audio API synthesizer for Family Feud TV Sound Effects
 * 100% offline, zero external dependencies.
 */

let audioCtx: AudioContext | null = null;
let masterBus: GainNode | null = null;
let outputCompressor: DynamicsCompressorNode | null = null;
let roomReverb: ConvolverNode | null = null;
let roomReverbReturn: GainNode | null = null;
let masterVolume = 0.8;
let masterMuted = false;

export function setMasterVolume(volume: number) {
  masterVolume = Math.max(0, Math.min(1, volume));
  if (audioCtx && masterBus) masterBus.gain.setTargetAtTime(masterMuted ? 0 : masterVolume, audioCtx.currentTime, 0.025);
}

export function setAudioControls(volume: number, muted: boolean) {
  masterMuted = muted;
  setMasterVolume(volume);
}

function getMasterBus(ctx: AudioContext): GainNode {
  if (!masterBus) {
    masterBus = ctx.createGain();
    masterBus.gain.value = masterMuted ? 0 : masterVolume;
    outputCompressor = ctx.createDynamicsCompressor();
    outputCompressor.threshold.value = -12;
    outputCompressor.knee.value = 10;
    outputCompressor.ratio.value = 3;
    outputCompressor.attack.value = 0.004;
    outputCompressor.release.value = 0.22;
    masterBus.connect(outputCompressor);
    outputCompressor.connect(ctx.destination);
  }
  return masterBus;
}

/** A short, original studio-room tail adds space while keeping effects crisp. */
function getRoomReverb(ctx: AudioContext): ConvolverNode {
  if (!roomReverb) {
    const length = Math.floor(ctx.sampleRate * 0.72);
    const impulse = ctx.createBuffer(2, length, ctx.sampleRate);
    for (let channelIndex = 0; channelIndex < impulse.numberOfChannels; channelIndex++) {
      const channel = impulse.getChannelData(channelIndex);
      for (let i = 0; i < length; i++) {
        const fade = Math.pow(1 - i / length, 3.4);
        channel[i] = (Math.random() * 2 - 1) * fade * 0.32;
      }
    }
    roomReverb = ctx.createConvolver();
    roomReverb.buffer = impulse;
    roomReverbReturn = ctx.createGain();
    roomReverbReturn.gain.value = 0.2;
    roomReverb.connect(roomReverbReturn);
    roomReverbReturn.connect(getMasterBus(ctx));
  }
  return roomReverb;
}

export function playRevealAccent(volume = masterVolume, muted = false) {
  if (muted || volume <= 0) return;
  try {
    const ctx = getAudioContext();
    const now = ctx.currentTime;
    const master = Math.max(0, Math.min(1, volume));
    [523.25, 783.99, 1174.66].forEach((frequency, index) => {
      const oscillator = ctx.createOscillator();
      const envelope = ctx.createGain();
      const pan = ctx.createStereoPanner();
      oscillator.type = 'sine';
      oscillator.frequency.setValueAtTime(frequency * 0.82, now + index * 0.055);
      oscillator.frequency.exponentialRampToValueAtTime(frequency, now + index * 0.055 + 0.12);
      envelope.gain.setValueAtTime(0.0001, now + index * 0.055);
      envelope.gain.exponentialRampToValueAtTime(0.12 * master / (index + 1), now + index * 0.055 + 0.025);
      envelope.gain.exponentialRampToValueAtTime(0.0001, now + 0.7);
      pan.pan.setValueAtTime(index === 0 ? -0.16 : index === 2 ? 0.16 : 0, now);
      oscillator.connect(envelope); envelope.connect(pan); pan.connect(getMasterBus(ctx));
      oscillator.start(now + index * 0.055); oscillator.stop(now + 0.75);
    });
  } catch { /* Audio is optional when browser playback is unavailable. */ }
}

function getAudioContext(): AudioContext {
  if (!audioCtx) {
    const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    audioCtx = new AudioContextClass();
  }
  if (audioCtx.state === 'suspended') {
    audioCtx.resume();
  }
  return audioCtx;
}

/**
 * 1. Chime / Ding - Correct answer reveal
 */
export function playChime() {
  try {
    const ctx = getAudioContext();
    const now = ctx.currentTime;

    const frequencies = [880, 1318.51, 1760]; // A5, E6, A6

    frequencies.forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, now);

      gain.gain.setValueAtTime(0, now);
      gain.gain.linearRampToValueAtTime(0.25 / (idx + 1), now + 0.015);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 1.2);

      osc.connect(gain);
      gain.connect(getMasterBus(ctx));
      gain.connect(getRoomReverb(ctx));

      osc.start(now);
      osc.stop(now + 1.3);
    });
  } catch (e) {
    console.error('Audio error', e);
  }
}

/**
 * 2. Strike Buzzer - Iconic TV Game Show ❌ Buzzer
 */
export function playStrike() {
  try {
    const ctx = getAudioContext();
    const now = ctx.currentTime;

    const tones = [98, 110, 116.54, 155.56, 233.08];

    tones.forEach((freq) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(freq, now);

      const lfo = ctx.createOscillator();
      lfo.frequency.setValueAtTime(40, now);
      const lfoGain = ctx.createGain();
      lfoGain.gain.setValueAtTime(14, now);
      lfo.connect(lfoGain);
      lfoGain.connect(osc.frequency);
      lfo.start(now);
      lfo.stop(now + 0.85);

      gain.gain.setValueAtTime(0, now);
      gain.gain.linearRampToValueAtTime(0.45, now + 0.015);
      gain.gain.setValueAtTime(0.45, now + 0.65);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.85);

      osc.connect(gain);
      gain.connect(getMasterBus(ctx));

      osc.start(now);
      osc.stop(now + 0.9);
    });
  } catch (e) {
    console.error('Audio error', e);
  }
}

/**
 * 3. Bell - Desk bell
 */
export function playBell() {
  try {
    const ctx = getAudioContext();
    const now = ctx.currentTime;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(2093, now); // C7

    gain.gain.setValueAtTime(0.4, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.9);

    osc.connect(gain);
    gain.connect(getMasterBus(ctx));
    gain.connect(getRoomReverb(ctx));

    osc.start(now);
    osc.stop(now + 1.0);
  } catch (e) {
    console.error('Audio error', e);
  }
}

/**
 * 4. Steal Alert - Tension stinger
 */
export function playStealAlert() {
  try {
    const ctx = getAudioContext();
    const now = ctx.currentTime;

    const freqs = [392, 523.25, 659.25, 783.99];
    freqs.forEach((freq, index) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = index % 2 ? 'triangle' : 'sawtooth';
      osc.frequency.setValueAtTime(freq * 0.72, now + index * 0.075);
      osc.frequency.exponentialRampToValueAtTime(freq, now + index * 0.075 + 0.11);

      gain.gain.setValueAtTime(0, now);
      gain.gain.linearRampToValueAtTime(0.13, now + index * 0.075 + 0.04);
      gain.gain.setValueAtTime(0.1, now + index * 0.075 + 0.2);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 1.05);

      osc.connect(gain);
      gain.connect(getMasterBus(ctx));

      osc.start(now + index * 0.075);
      osc.stop(now + 1.1);
    });
  } catch (e) {
    console.error('Audio error', e);
  }
}

/**
 * 5. Celebration Horns / تزمير الفوز الحماسي (Stadium Party Air Horns)
 * The iconic festive air horn celebration blast pattern:
 * "توت! توت! توت! تووووووووووت!"
 */
export function playCelebrationHorns() {
  try {
    const ctx = getAudioContext();
    const now = ctx.currentTime;

    // Authentic stadium air horn frequencies (harmonic chord stack)
    const hornFrequencies = [349.23, 440.0, 523.25, 698.46, 880.0]; // F4, A4, C5, F5, A5

    // Rhythmic celebration pattern:
    // Blast 1 (0.13s), pause, Blast 2 (0.13s), pause, Blast 3 (0.13s), pause, Long Blast 4 (0.8s), reprise
    const blasts = [
      { start: 0.0, duration: 0.14 },
      { start: 0.22, duration: 0.14 },
      { start: 0.44, duration: 0.14 },
      { start: 0.70, duration: 0.85 },
      { start: 1.75, duration: 0.16 },
      { start: 2.05, duration: 0.95 },
    ];

    blasts.forEach(({ start, duration }) => {
      const blastTime = now + start;

      hornFrequencies.forEach((freq, fIndex) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        const filter = ctx.createBiquadFilter();

        osc.type = fIndex % 2 === 0 ? 'sawtooth' : 'square';

        // Pitch scoop characteristic of pneumatic air horns
        osc.frequency.setValueAtTime(freq * 0.96, blastTime);
        osc.frequency.exponentialRampToValueAtTime(freq, blastTime + 0.035);

        // Air horn bandpass resonance filter
        filter.type = 'bandpass';
        filter.frequency.setValueAtTime(freq * 1.4, blastTime);
        filter.Q.setValueAtTime(1.5, blastTime);

        // Sharp horn attack and release envelope
        gain.gain.setValueAtTime(0, blastTime);
        gain.gain.linearRampToValueAtTime(0.28 / (fIndex * 0.4 + 1), blastTime + 0.015);
        gain.gain.setValueAtTime(0.25 / (fIndex * 0.4 + 1), blastTime + duration - 0.03);
        gain.gain.exponentialRampToValueAtTime(0.0001, blastTime + duration);

        osc.connect(filter);
        filter.connect(gain);
        gain.connect(getMasterBus(ctx));

        osc.start(blastTime);
        osc.stop(blastTime + duration + 0.05);
      });
    });
  } catch (e) {
    console.error('Audio error', e);
  }
}

/**
 * Dispatch sound helper
 */
export function playSound(sound: 'chime' | 'strike' | 'bell' | 'tick' | 'duplicate' | 'applause' | 'fanfare' | 'steal') {
  if (masterMuted || masterVolume <= 0) return;
  switch (sound) {
    case 'chime':
      playChime();
      break;
    case 'strike':
      playStrike();
      break;
    case 'bell':
      playBell();
      break;
    case 'fanfare':
      // تزمير الفوز الحماسي
      playCelebrationHorns();
      break;
    case 'steal':
      playStealAlert();
      break;
    case 'applause':
      // Disabled / silence as user requested no point movement noise
      break;
  }
}
