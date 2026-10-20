import { Injectable } from '@angular/core';

@Injectable({
  providedIn: 'root'
})
export class SoundService {
  private ctx: AudioContext | null = null;
  public muted = false;

  private ensureContext(): AudioContext | null {
    if (this.muted) return null;
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.ctx = new AudioCtx();
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
    return this.ctx;
  }

  playShoot(weaponId: string, isUpgraded: boolean): void {
    const ctx = this.ensureContext();
    if (!ctx) return;

    const now = ctx.currentTime;

    if (weaponId === 'anor_staff' || weaponId === 'durin_thunder') {
      // Magical blast sound
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = isUpgraded ? 'sawtooth' : 'triangle';
      osc.frequency.setValueAtTime(isUpgraded ? 360 : 210, now);
      osc.frequency.exponentialRampToValueAtTime(38, now + 0.32);

      gain.gain.setValueAtTime(isUpgraded ? 0.36 : 0.3, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.34);

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.34);
    } else {
      // Bow / Crossbow twang + sharp bolt whoosh
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = isUpgraded ? 'sawtooth' : 'triangle';
      const baseFreq = weaponId === 'erebor_crossbow' ? 150 : 240;
      osc.frequency.setValueAtTime(isUpgraded ? baseFreq * 1.75 : baseFreq, now);
      osc.frequency.exponentialRampToValueAtTime(48, now + 0.16);

      gain.gain.setValueAtTime(isUpgraded ? 0.28 : 0.24, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.17);

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.17);
    }

    // Iconic CoD Zombies Pack-a-Punch High-Energy Laser Harmonic "PEW-ZAP" + Sub-Bass Punch
    if (isUpgraded) {
      const laserOsc = ctx.createOscillator();
      const laserGain = ctx.createGain();
      laserOsc.type = 'sine';
      laserOsc.frequency.setValueAtTime(1680, now);
      laserOsc.frequency.exponentialRampToValueAtTime(280, now + 0.13);

      laserGain.gain.setValueAtTime(0.18, now);
      laserGain.gain.exponentialRampToValueAtTime(0.001, now + 0.14);

      laserOsc.connect(laserGain);
      laserGain.connect(ctx.destination);
      laserOsc.start(now);
      laserOsc.stop(now + 0.14);

      const subOsc = ctx.createOscillator();
      const subGain = ctx.createGain();
      subOsc.type = 'triangle';
      subOsc.frequency.setValueAtTime(115, now);
      subOsc.frequency.exponentialRampToValueAtTime(28, now + 0.2);

      subGain.gain.setValueAtTime(0.26, now);
      subGain.gain.exponentialRampToValueAtTime(0.001, now + 0.21);

      subOsc.connect(subGain);
      subGain.connect(ctx.destination);
      subOsc.start(now);
      subOsc.stop(now + 0.21);
    }
  }

  playHit(isHeadshot: boolean): void {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = isHeadshot ? 'square' : 'sine';
    osc.frequency.setValueAtTime(isHeadshot ? 920 : 190, now);
    osc.frequency.exponentialRampToValueAtTime(isHeadshot ? 320 : 80, now + 0.08);

    gain.gain.setValueAtTime(isHeadshot ? 0.22 : 0.15, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.09);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.09);
  }

  playPurchase(): void {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;

    // Classic CoD register / Elven chime
    [523.25, 659.25, 783.99, 1046.5].forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, now + idx * 0.055);
      gain.gain.setValueAtTime(0.18, now + idx * 0.055);
      gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.055 + 0.25);

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now + idx * 0.055);
      osc.stop(now + idx * 0.055 + 0.26);
    });
  }

  playRepairPlank(): void {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;

    // Wood thud + coin clink
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(140, now);
    osc.frequency.exponentialRampToValueAtTime(55, now + 0.1);
    gain.gain.setValueAtTime(0.25, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.11);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.11);

    const bell = ctx.createOscillator();
    const bellGain = ctx.createGain();
    bell.type = 'sine';
    bell.frequency.setValueAtTime(880, now + 0.06);
    bellGain.gain.setValueAtTime(0.12, now + 0.06);
    bellGain.gain.exponentialRampToValueAtTime(0.001, now + 0.22);
    bell.connect(bellGain);
    bellGain.connect(ctx.destination);
    bell.start(now + 0.06);
    bell.stop(now + 0.23);
  }

  playBreakPlank(): void {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(110, now);
    osc.frequency.exponentialRampToValueAtTime(35, now + 0.18);
    gain.gain.setValueAtTime(0.22, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.19);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.19);
  }

  playRoundHornAndDrums(): void {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;

    // "Drums in the deep... Doom, doom" + eerie horn
    [0, 0.55].forEach((offset) => {
      const drum = ctx.createOscillator();
      const drumGain = ctx.createGain();
      drum.type = 'sine';
      drum.frequency.setValueAtTime(85, now + offset);
      drum.frequency.exponentialRampToValueAtTime(28, now + offset + 0.42);
      drumGain.gain.setValueAtTime(0.45, now + offset);
      drumGain.gain.exponentialRampToValueAtTime(0.001, now + offset + 0.45);
      drum.connect(drumGain);
      drumGain.connect(ctx.destination);
      drum.start(now + offset);
      drum.stop(now + offset + 0.46);
    });

    // Horn of Gondor / Moria eerie chord
    [146.83, 220.0, 261.63].forEach((freq) => {
      const horn = ctx.createOscillator();
      const hornGain = ctx.createGain();
      horn.type = 'sawtooth';
      horn.frequency.setValueAtTime(freq, now + 0.15);
      hornGain.gain.setValueAtTime(0.001, now + 0.15);
      hornGain.gain.linearRampToValueAtTime(0.08, now + 0.6);
      hornGain.gain.exponentialRampToValueAtTime(0.001, now + 2.4);
      horn.connect(hornGain);
      hornGain.connect(ctx.destination);
      horn.start(now + 0.15);
      horn.stop(now + 2.45);
    });
  }

  playPlayerDamage(): void {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(95, now);
    osc.frequency.exponentialRampToValueAtTime(40, now + 0.22);
    gain.gain.setValueAtTime(0.35, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.24);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.24);
  }

  playWeaponSwitch(isDraw = false): void {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'triangle';
    if (isDraw) {
      osc.frequency.setValueAtTime(140, now);
      osc.frequency.exponentialRampToValueAtTime(290, now + 0.09);
    } else {
      osc.frequency.setValueAtTime(240, now);
      osc.frequency.exponentialRampToValueAtTime(110, now + 0.08);
    }

    gain.gain.setValueAtTime(0.12, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.095);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.1);
  }

  playMenuHover(): void {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(880, now);
    osc.frequency.exponentialRampToValueAtTime(1320, now + 0.035);

    gain.gain.setValueAtTime(0.04, now);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.04);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.045);
  }

  playMenuClick(): void {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;

    // Resonant metallic click
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(420, now);
    osc.frequency.exponentialRampToValueAtTime(140, now + 0.08);

    gain.gain.setValueAtTime(0.14, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.085);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.09);
  }

  playMenuLaunch(): void {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;

    // Deep war drum impact + ominous rising chord
    const drum = ctx.createOscillator();
    const drumGain = ctx.createGain();
    drum.type = 'sine';
    drum.frequency.setValueAtTime(95, now);
    drum.frequency.exponentialRampToValueAtTime(32, now + 0.55);

    drumGain.gain.setValueAtTime(0.5, now);
    drumGain.gain.exponentialRampToValueAtTime(0.001, now + 0.6);

    drum.connect(drumGain);
    drumGain.connect(ctx.destination);
    drum.start(now);
    drum.stop(now + 0.65);

    [220, 277.18, 329.63].forEach((f, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(f, now + 0.05);
      gain.gain.setValueAtTime(0.001, now + 0.05);
      gain.gain.linearRampToValueAtTime(0.1, now + 0.3);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 1.4);

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now + 0.05);
      osc.stop(now + 1.45);
    });
  }
}

