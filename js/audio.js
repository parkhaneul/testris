/**
 * Web Audio API 기반 사운드 효과
 * AudioContext는 첫 사용자 인터랙션 후 생성 (브라우저 정책)
 */

let ctx = null;

function getCtx() {
  if (!ctx) ctx = new AudioContext();
  if (ctx.state === 'suspended') ctx.resume();
  return ctx;
}

// ── 블럭 집기 사운드 ─────────────────────────────────────────────
// 짧고 부드러운 "톡" — 저→고 주파수 슬라이드
export function playPickup() {
  try {
    const c   = getCtx();
    const now = c.currentTime;
    const osc  = c.createOscillator();
    const gain = c.createGain();

    osc.connect(gain);
    gain.connect(c.destination);

    osc.type = 'sine';
    osc.frequency.setValueAtTime(320, now);
    osc.frequency.exponentialRampToValueAtTime(580, now + 0.07);

    gain.gain.setValueAtTime(0.22, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.13);

    osc.start(now);
    osc.stop(now + 0.13);
  } catch {}
}

// ── 라인 클리어 사운드 ───────────────────────────────────────────
// 클리어 줄 수만큼 올라가는 아르페지오 + 임팩트 노이즈
export function playLineClear(totalLines) {
  try {
    const c   = getCtx();
    const now = c.currentTime;

    // 임팩트 노이즈 (화이트 노이즈 버스트)
    const bufLen = Math.floor(c.sampleRate * 0.12);
    const buf    = c.createBuffer(1, bufLen, c.sampleRate);
    const data   = buf.getChannelData(0);
    for (let i = 0; i < bufLen; i++) data[i] = Math.random() * 2 - 1;

    const noise       = c.createBufferSource();
    const noiseFilter = c.createBiquadFilter();
    const noiseGain   = c.createGain();
    noise.buffer          = buf;
    noiseFilter.type      = 'bandpass';
    noiseFilter.frequency.value = 900;
    noiseFilter.Q.value   = 0.8;
    noise.connect(noiseFilter);
    noiseFilter.connect(noiseGain);
    noiseGain.connect(c.destination);
    noiseGain.gain.setValueAtTime(0.12 * Math.min(totalLines, 4), now);
    noiseGain.gain.exponentialRampToValueAtTime(0.001, now + 0.14);
    noise.start(now);
    noise.stop(now + 0.14);

    // 아르페지오 (클리어 줄 수에 따라 음 개수 증가)
    const freqs = [523.25, 659.25, 783.99, 1046.5]; // C5 E5 G5 C6
    const count = Math.min(totalLines, 4);
    for (let i = 0; i < count; i++) {
      const t    = now + i * 0.075;
      const osc  = c.createOscillator();
      const gain = c.createGain();
      osc.connect(gain);
      gain.connect(c.destination);

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freqs[i], t);

      gain.gain.setValueAtTime(0.28, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.32);

      osc.start(t);
      osc.stop(t + 0.32);
    }
  } catch {}
}
