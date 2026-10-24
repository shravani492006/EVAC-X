/** Optional sound effects, synthesised with WebAudio (no asset files). Muted state persists in localStorage. */
class SoundEngine {
  constructor() {
    this.ctx = null; this.alarmTimer = null;
    try { this.muted = localStorage.getItem('evacx_muted') === '1'; } catch { this.muted = false; }
  }
  _ensure() {
    if (this.muted) return null;
    if (!this.ctx) { try { this.ctx = new (window.AudioContext || window.webkitAudioContext)(); } catch { return null; } }
    if (this.ctx.state === 'suspended') this.ctx.resume().catch(() => {});
    return this.ctx;
  }
  setMuted(m) { this.muted = m; try { localStorage.setItem('evacx_muted', m ? '1' : '0'); } catch { /* ignore */ } if (m) this.stopAlarm(); }
  tone(freq, dur = 0.12, type = 'sine', vol = 0.05, when = 0, slideTo = null) {
    const ctx = this._ensure(); if (!ctx) return;
    const t = ctx.currentTime + when, o = ctx.createOscillator(), g = ctx.createGain();
    o.type = type; o.frequency.setValueAtTime(freq, t);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
    g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(ctx.destination); o.start(t); o.stop(t + dur + 0.02);
  }
  play(name) {
    switch (name) {
      case 'click': this.tone(520, 0.05, 'square', 0.025); break;
      case 'evac': this.tone(660, 0.08, 'sine', 0.035); this.tone(880, 0.1, 'sine', 0.035, 0.07); break;
      case 'warning': this.tone(300, 0.18, 'sawtooth', 0.04, 0, 200); break;
      case 'success': [523, 659, 784, 1047].forEach((f, i) => this.tone(f, 0.22, 'triangle', 0.06, i * 0.12)); this.stopAlarm(); break;
      case 'gameover': [392, 330, 262, 196].forEach((f, i) => this.tone(f, 0.3, 'sawtooth', 0.05, i * 0.18)); this.stopAlarm(); break;
      case 'alarm': this.startAlarm(); break;
      default: break;
    }
  }
  startAlarm() {
    this.stopAlarm();
    if (this.muted) return;
    let n = 0;
    const beep = () => { this.tone(n++ % 2 ? 740 : 980, 0.22, 'square', 0.022); };
    beep(); this.alarmTimer = setInterval(beep, 450);
    setTimeout(() => this.stopAlarm(), 5000);
  }
  stopAlarm() { if (this.alarmTimer) { clearInterval(this.alarmTimer); this.alarmTimer = null; } }
}
export const sound = new SoundEngine();
