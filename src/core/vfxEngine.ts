import { SoulType } from '../types';
import { ObjectPool } from './pool';

export type VFXType = 'fire' | 'water' | 'plant' | 'electric' | 'shadow' | 'light' | 'heal' | 'capture' | 'levelup' | 'slash' | 'explosion';

export interface FloatingText {
  id: string;
  text: string;
  x: number;
  y: number;
  color: string;
  fontSize?: string;
  life: number;
  maxLife: number;
}

export interface Particle {
  id: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  color: string;
  alpha: number;
  life: number;
  maxLife: number;
}

export interface ActiveVFX {
  id: string;
  type: VFXType;
  x: number;
  y: number;
  color: string;
  scale: number;
  life: number;
  maxLife: number;
}

class VFXEngine {
  private listeners: ((state: { texts: FloatingText[]; particles: Particle[]; vfxList: ActiveVFX[]; screenFlash: string | null; screenShake: boolean }) => void)[] = [];
  
  private texts: FloatingText[] = [];
  private particles: Particle[] = [];
  private vfxList: ActiveVFX[] = [];
  
  private textPool: ObjectPool<FloatingText>;
  private particlePool: ObjectPool<Particle>;
  private vfxPool: ObjectPool<ActiveVFX>;

  private screenFlash: string | null = null;
  private screenShake: boolean = false;
  private shakeTimer: number = 0;
  private animationFrameId: number | null = null;
  private lastTime: number = performance.now();

  constructor() {
    this.textPool = new ObjectPool<FloatingText>(
      () => ({ id: '', text: '', x: 0, y: 0, color: '', life: 0, maxLife: 0 }),
      (t) => { t.id = ''; t.text = ''; }
    );
    this.particlePool = new ObjectPool<Particle>(
      () => ({ id: '', x: 0, y: 0, vx: 0, vy: 0, size: 0, color: '', alpha: 0, life: 0, maxLife: 0 }),
      (p) => { p.id = ''; }
    );
    this.vfxPool = new ObjectPool<ActiveVFX>(
      () => ({ id: '', type: 'explosion', x: 0, y: 0, color: '', scale: 0, life: 0, maxLife: 0 }),
      (v) => { v.id = ''; }
    );

    this.startLoop();
  }

  private isNotifyPending = false;

  public subscribe(listener: (state: { texts: FloatingText[]; particles: Particle[]; vfxList: ActiveVFX[]; screenFlash: string | null; screenShake: boolean }) => void) {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter(l => l !== listener);
    };
  }

  private notify() {
    if (this.isNotifyPending) return;
    this.isNotifyPending = true;
    queueMicrotask(() => {
      this.isNotifyPending = false;
      const state = {
        texts: [...this.texts],
        particles: [...this.particles],
        vfxList: [...this.vfxList],
        screenFlash: this.screenFlash,
        screenShake: this.screenShake,
      };
      this.listeners.forEach(l => l(state));
    });
  }

  private startLoop() {
    const update = (time: number) => {
      const dt = Math.min(0.1, (time - this.lastTime) / 1000);
      this.lastTime = time;

      let changed = false;

      for (let i = this.texts.length - 1; i >= 0; i--) {
        const t = this.texts[i];
        t.life -= dt;
        t.y -= dt * 40;
        if (t.life <= 0) {
          this.textPool.release(this.texts.splice(i, 1)[0]);
          changed = true;
        }
      }

      for (let i = this.particles.length - 1; i >= 0; i--) {
        const p = this.particles[i];
        p.vx *= p.drag; // Apply drag
        p.vy *= p.drag; // Apply drag
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.life -= dt;
        p.alpha = Math.max(0, p.life / p.maxLife);
        if (p.life <= 0) {
          this.particlePool.release(this.particles.splice(i, 1)[0]);
          changed = true;
        }
      }

      for (let i = this.vfxList.length - 1; i >= 0; i--) {
        const v = this.vfxList[i];
        v.life -= dt;
        if (v.life <= 0) {
          this.vfxPool.release(this.vfxList.splice(i, 1)[0]);
          changed = true;
        }
      }

      if (this.screenShake) {
        this.shakeTimer -= dt;
        if (this.shakeTimer <= 0) {
          this.screenShake = false;
          changed = true;
        }
      }

      if (changed || this.texts.length > 0 || this.particles.length > 0 || this.vfxList.length > 0 || this.screenFlash || this.screenShake) {
        this.notify();
      }

      this.animationFrameId = requestAnimationFrame(update);
    };
    this.animationFrameId = requestAnimationFrame(update);
  }

  public triggerSkillVFX(type: SoulType | VFXType, x: number, y: number) {
    const config = {
      Fuego: { color: '#ef4444', type: 'fire' as VFXType, count: 60, speed: 180, gravity: -80, drag: 0.92, size: 8 },
      Agua: { color: '#38bdf8', type: 'water' as VFXType, count: 50, speed: 120, gravity: 40, drag: 0.95, size: 6 },
      Planta: { color: '#4ade80', type: 'plant' as VFXType, count: 50, speed: 90, gravity: 0, drag: 0.9, size: 5 },
      Rayo: { color: '#facc15', type: 'electric' as VFXType, count: 80, speed: 250, gravity: 0, drag: 0.85, size: 4 },
      Sombra: { color: '#a855f7', type: 'shadow' as VFXType, count: 40, speed: 100, gravity: 20, drag: 0.94, size: 7 },
      Luz: { color: '#fbbf24', type: 'light' as VFXType, count: 40, speed: 140, gravity: -20, drag: 0.93, size: 6 }
    }[type as SoulType] || { color: '#ffffff', type: 'explosion' as VFXType, count: 30, speed: 100, gravity: 0, drag: 0.9, size: 5 };

    for (let i = 0; i < config.count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = Math.random() * config.speed;
      const p = this.particlePool.get();
      Object.assign(p, {
        id: `p-${Math.random()}`,
        x, y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed + config.gravity,
        size: config.size * (0.5 + Math.random()),
        color: config.color,
        alpha: 1.0,
        life: 0.6 + Math.random() * 0.4,
        maxLife: 1.0,
        drag: config.drag // New property for physics simulation
      });
      this.particles.push(p);
    }

    const v = this.vfxPool.get();
    Object.assign(v, {
      id: `vfx-${Math.random()}`,
      type: config.type,
      x, y, color: config.color,
      scale: 1.5,
      life: 0.8,
      maxLife: 0.8,
    });
    this.vfxList.push(v);

    this.triggerScreenFlash(config.color, 0.15);
    this.triggerScreenShake(0.25);
  }

  public showFloatingText(text: string, x: number, y: number, color: string = '#ffffff', fontSize: string = 'text-xl') {
    const t = this.textPool.get();
    Object.assign(t, {
      id: `txt-${Math.random()}`,
      text, x, y, color, fontSize,
      life: 1.0,
      maxLife: 1.0,
    });
    this.texts.push(t);
    this.notify();
  }

  public triggerScreenFlash(color: string, duration: number = 0.25) {
    this.screenFlash = color;
    this.notify();
    setTimeout(() => {
      this.screenFlash = null;
      this.notify();
    }, duration * 1000);
  }

  public triggerScreenShake(duration: number = 0.3) {
    this.screenShake = true;
    this.shakeTimer = duration;
    this.notify();
  }
}

export const vfxEngine = new VFXEngine();
