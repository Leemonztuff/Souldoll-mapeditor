/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import * as THREE from 'three';
import { getNPCSpriteTexture } from './npcSprites';

export function createGroundTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 128;
  const ctx = canvas.getContext('2d')!;
  ctx.imageSmoothingEnabled = false;

  // Luminous moonlit sapphire/indigo base
  ctx.fillStyle = '#141f38';
  ctx.fillRect(0, 0, 128, 128);

  // Subtle procedural turf texture & soil grain
  for (let x = 0; x < 128; x += 2) {
    for (let y = 0; y < 128; y += 2) {
      const n = Math.sin(x * 12.9898 + y * 78.233) * 43758.5453;
      const val = n - Math.floor(n);
      if (val > 0.72) {
        ctx.fillStyle = '#1a294a';
        ctx.fillRect(x, y, 2, 2);
      } else if (val < 0.22) {
        ctx.fillStyle = '#10192e';
        ctx.fillRect(x, y, 2, 2);
      } else if (val > 0.58 && val <= 0.65) {
        ctx.fillStyle = '#182542';
        ctx.fillRect(x, y, 2, 2);
      }
    }
  }

  // Scattered pixel grass blade tufts (vibrant cyan and azure)
  const grassClusters = [
    { x: 12, y: 16 }, { x: 44, y: 8 }, { x: 78, y: 22 }, { x: 104, y: 14 },
    { x: 28, y: 46 }, { x: 62, y: 38 }, { x: 92, y: 52 }, { x: 118, y: 40 },
    { x: 8, y: 78 }, { x: 38, y: 92 }, { x: 74, y: 76 }, { x: 102, y: 86 },
    { x: 22, y: 112 }, { x: 54, y: 120 }, { x: 88, y: 110 }, { x: 116, y: 118 },
    { x: 50, y: 64 }, { x: 84, y: 98 }, { x: 16, y: 56 }, { x: 108, y: 68 },
  ];

  grassClusters.forEach(g => {
    // Left blade
    ctx.fillStyle = '#1d4ed8';
    ctx.fillRect(g.x, g.y + 2, 2, 4);
    ctx.fillStyle = '#38bdf8';
    ctx.fillRect(g.x, g.y, 2, 2);
    // Center tall blade
    ctx.fillStyle = '#2563eb';
    ctx.fillRect(g.x + 2, g.y + 1, 2, 5);
    ctx.fillStyle = '#7dd3fc';
    ctx.fillRect(g.x + 2, g.y - 2, 2, 3);
    // Right blade
    ctx.fillStyle = '#1e3a8a';
    ctx.fillRect(g.x + 4, g.y + 3, 2, 3);
    ctx.fillStyle = '#38bdf8';
    ctx.fillRect(g.x + 4, g.y + 1, 2, 2);
  });

  // Natural slate cobblestones / pebbles
  const stones = [
    { x: 24, y: 32, w: 6, h: 4 }, { x: 86, y: 44, w: 7, h: 5 }, { x: 102, y: 108, w: 5, h: 3 },
    { x: 48, y: 88, w: 8, h: 5 }, { x: 16, y: 114, w: 6, h: 4 }, { x: 112, y: 22, w: 5, h: 4 },
    { x: 68, y: 14, w: 5, h: 3 }, { x: 34, y: 72, w: 6, h: 4 },
  ];
  stones.forEach(s => {
    // Shadow
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(s.x, s.y + 1, s.w, s.h);
    // Stone body
    ctx.fillStyle = '#475569';
    ctx.fillRect(s.x, s.y, s.w - 1, s.h - 1);
    // Moonlit highlight edge
    ctx.fillStyle = '#94a3b8';
    ctx.fillRect(s.x, s.y, s.w - 2, 1);
    ctx.fillRect(s.x, s.y, 1, s.h - 2);
    // Subtle spec
    ctx.fillStyle = '#cbd5e1';
    ctx.fillRect(s.x + 1, s.y + 1, 1, 1);
  });

  // Enchanting fairy flowers (pink, cyan, and gold)
  const flowers = [
    { x: 36, y: 26, type: 'pink' }, { x: 74, y: 16, type: 'cyan' },
    { x: 96, y: 72, type: 'pink' }, { x: 32, y: 82, type: 'gold' },
    { x: 62, y: 108, type: 'cyan' }, { x: 114, y: 94, type: 'pink' },
    { x: 12, y: 62, type: 'cyan' }, { x: 80, y: 48, type: 'gold' },
    { x: 44, y: 114, type: 'pink' }, { x: 100, y: 34, type: 'pink' },
  ];
  flowers.forEach(f => {
    const petalColor = f.type === 'pink' ? '#f472b6' : f.type === 'cyan' ? '#38bdf8' : '#fbbf24';
    const darkPetal = f.type === 'pink' ? '#db2777' : f.type === 'cyan' ? '#0284c7' : '#d97706';
    const centerColor = f.type === 'pink' ? '#fef08a' : f.type === 'cyan' ? '#ffffff' : '#fef9c3';

    // Petals
    ctx.fillStyle = darkPetal;
    ctx.fillRect(f.x - 1, f.y, 4, 2);
    ctx.fillRect(f.x, f.y - 1, 2, 4);

    ctx.fillStyle = petalColor;
    ctx.fillRect(f.x - 1, f.y, 1, 2);
    ctx.fillRect(f.x + 2, f.y, 1, 2);
    ctx.fillRect(f.x, f.y - 1, 2, 1);
    ctx.fillRect(f.x, f.y + 2, 2, 1);

    // Glowing core
    ctx.fillStyle = centerColor;
    ctx.fillRect(f.x, f.y, 2, 2);
  });

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(40, 40);
  texture.magFilter = THREE.NearestFilter;
  texture.minFilter = THREE.NearestFilter;
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

export function createHeroTexture(animFrame: number): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 32;
  canvas.height = 48;
  const ctx = canvas.getContext('2d')!;
  ctx.imageSmoothingEnabled = false;
  ctx.clearRect(0, 0, 32, 48);

  let legOffsetLeft = 0;
  let legOffsetRight = 0;
  let axeOffsetY = 0;
  let bodyBob = 0;

  if (animFrame === 1) {
    legOffsetLeft = 2;
    legOffsetRight = -2;
    axeOffsetY = 1;
    bodyBob = 1;
  } else if (animFrame === 3) {
    legOffsetLeft = -2;
    legOffsetRight = 2;
    axeOffsetY = -1;
    bodyBob = 1;
  }

  ctx.fillStyle = 'rgba(0,0,0,0.4)';
  ctx.beginPath();
  ctx.ellipse(16, 44, 8, 3, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = '#1b4d3e';
  ctx.fillRect(11, 34 + legOffsetLeft, 4, 8);
  ctx.fillRect(17, 34 + legOffsetRight, 4, 8);
  ctx.fillStyle = '#11221b';
  ctx.fillRect(10, 41 + legOffsetLeft, 5, 3);
  ctx.fillRect(17, 41 + legOffsetRight, 5, 3);

  ctx.fillStyle = '#e2e8f0';
  ctx.fillRect(10, 18 - bodyBob, 12, 17);
  ctx.fillStyle = '#cbd5e1';
  ctx.fillRect(10, 24 - bodyBob, 12, 2);

  ctx.fillStyle = '#78350f';
  ctx.fillRect(10, 32 - bodyBob, 12, 3);
  ctx.fillStyle = '#fbbf24';
  ctx.fillRect(14, 32 - bodyBob, 4, 3);

  ctx.fillStyle = '#2d6a4f';
  ctx.fillRect(7, 18 - bodyBob, 4, 10);
  ctx.fillRect(21, 18 - bodyBob, 4, 10);

  ctx.fillStyle = '#2d6a4f';
  ctx.fillRect(11, 8 - bodyBob, 10, 10);
  ctx.fillStyle = '#1e293b';
  ctx.fillRect(10, 6 - bodyBob, 12, 6);
  ctx.fillRect(9, 9 - bodyBob, 2, 4);
  ctx.fillRect(21, 9 - bodyBob, 2, 4);
  ctx.fillStyle = '#334155';
  ctx.fillRect(13, 7 - bodyBob, 6, 2);

  ctx.fillStyle = '#713f12';
  ctx.fillRect(6, 14 + axeOffsetY, 2, 24);
  ctx.fillStyle = '#94a3b8';
  ctx.fillRect(2, 12 + axeOffsetY, 5, 8);
  ctx.fillStyle = '#ef4444';
  ctx.fillRect(4, 15 + axeOffsetY, 2, 3);

  const texture = new THREE.CanvasTexture(canvas);
  texture.magFilter = THREE.NearestFilter;
  texture.minFilter = THREE.NearestFilter;
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

export function createGrassTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 16;
  canvas.height = 16;
  const ctx = canvas.getContext('2d')!;
  ctx.imageSmoothingEnabled = false;
  ctx.clearRect(0, 0, 16, 16);

  // Deep shadow at roots
  ctx.fillStyle = '#0f172a';
  ctx.fillRect(2, 14, 12, 2);

  // Left blade (shorter, arched)
  ctx.fillStyle = '#1e3a8a';
  ctx.fillRect(3, 8, 2, 6);
  ctx.fillStyle = '#0284c7';
  ctx.fillRect(2, 5, 2, 4);
  ctx.fillStyle = '#38bdf8';
  ctx.fillRect(1, 3, 2, 3);
  ctx.fillStyle = '#7dd3fc';
  ctx.fillRect(1, 2, 1, 1);

  // Center-left main blade (tallest, glowing tip)
  ctx.fillStyle = '#1d4ed8';
  ctx.fillRect(6, 7, 2, 7);
  ctx.fillStyle = '#0ea5e9';
  ctx.fillRect(6, 3, 2, 5);
  ctx.fillStyle = '#38bdf8';
  ctx.fillRect(7, 1, 2, 3);
  ctx.fillStyle = '#e0f2fe';
  ctx.fillRect(7, 0, 1, 2);

  // Center-right blade
  ctx.fillStyle = '#1e40af';
  ctx.fillRect(9, 6, 2, 8);
  ctx.fillStyle = '#2563eb';
  ctx.fillRect(9, 3, 2, 4);
  ctx.fillStyle = '#38bdf8';
  ctx.fillRect(10, 1, 2, 3);
  ctx.fillStyle = '#bae6fd';
  ctx.fillRect(10, 0, 1, 1);

  // Right blade
  ctx.fillStyle = '#1e3a8a';
  ctx.fillRect(12, 8, 2, 6);
  ctx.fillStyle = '#0284c7';
  ctx.fillRect(13, 5, 2, 4);
  ctx.fillStyle = '#38bdf8';
  ctx.fillRect(14, 3, 1, 3);

  const texture = new THREE.CanvasTexture(canvas);
  texture.magFilter = THREE.NearestFilter;
  texture.minFilter = THREE.NearestFilter;
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

export function createExclamationTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 16;
  canvas.height = 16;
  const ctx = canvas.getContext('2d')!;
  ctx.imageSmoothingEnabled = false;
  ctx.clearRect(0, 0, 16, 16);

  ctx.fillStyle = '#facc15';
  ctx.fillRect(7, 2, 3, 8);
  ctx.fillRect(7, 12, 3, 3);

  const texture = new THREE.CanvasTexture(canvas);
  texture.magFilter = THREE.NearestFilter;
  texture.minFilter = THREE.NearestFilter;
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

export function createNPCTexture(villagerType: number): THREE.CanvasTexture {
  return getNPCSpriteTexture(villagerType);
}

export function createEnemyTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 32;
  canvas.height = 32;
  const ctx = canvas.getContext('2d')!;
  ctx.imageSmoothingEnabled = false;
  ctx.clearRect(0, 0, 32, 32);

  ctx.fillStyle = 'rgba(0,0,0,0.4)';
  ctx.beginPath();
  ctx.ellipse(16, 28, 8, 3, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = '#7c2d12';
  ctx.fillRect(8, 12, 16, 14);
  ctx.fillStyle = '#ef4444';
  ctx.fillRect(10, 15, 3, 3);
  ctx.fillRect(19, 15, 3, 3);

  const texture = new THREE.CanvasTexture(canvas);
  texture.magFilter = THREE.NearestFilter;
  texture.minFilter = THREE.NearestFilter;
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

export function createChestTexture(opened: boolean): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 32;
  canvas.height = 32;
  const ctx = canvas.getContext('2d')!;
  ctx.imageSmoothingEnabled = false;
  ctx.clearRect(0, 0, 32, 32);

  ctx.fillStyle = '#78350f';
  ctx.fillRect(6, 14, 20, 12);
  ctx.fillStyle = '#92400e';
  ctx.fillRect(6, opened ? 6 : 10, 20, 6);
  ctx.fillStyle = '#fbbf24';
  ctx.fillRect(14, 15, 4, 4);

  const texture = new THREE.CanvasTexture(canvas);
  texture.magFilter = THREE.NearestFilter;
  texture.minFilter = THREE.NearestFilter;
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

export function createDenseTreeTexture(variant: number): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 64;
  canvas.height = 96;
  const ctx = canvas.getContext('2d')!;
  ctx.imageSmoothingEnabled = false;
  ctx.clearRect(0, 0, 64, 96);

  // Soft moonlit ground shadow
  ctx.fillStyle = 'rgba(10, 16, 36, 0.5)';
  ctx.beginPath();
  ctx.ellipse(32, 90, 18, 5, 0, 0, Math.PI * 2);
  ctx.fill();

  // Purple/indigo-tinted stylized wooden trunk with flared roots
  // Roots
  ctx.fillStyle = '#1e1b4b';
  ctx.fillRect(20, 84, 24, 6);
  ctx.fillStyle = '#312e81';
  ctx.fillRect(22, 80, 20, 6);
  ctx.fillRect(18, 86, 6, 4);
  ctx.fillRect(40, 86, 6, 4);

  // Trunk body
  ctx.fillStyle = '#1e1b4b';
  ctx.fillRect(26, 46, 12, 36);
  ctx.fillStyle = '#312e81';
  ctx.fillRect(27, 46, 10, 35);
  ctx.fillStyle = '#4338ca';
  ctx.fillRect(29, 48, 6, 32);
  ctx.fillStyle = '#6366f1';
  ctx.fillRect(32, 50, 2, 28); // Moonlit edge highlight on trunk

  // Canopy lobes definition by tree variant
  // Each lobe is { cx, cy, rx, ry }
  type Lobe = { cx: number; cy: number; rx: number; ry: number };
  let lobes: Lobe[] = [];

  if (variant === 0) {
    // Classic lush tri-crown tree
    lobes = [
      { cx: 32, cy: 30, rx: 20, ry: 19 }, // Main central crown
      { cx: 20, cy: 42, rx: 16, ry: 15 }, // Left shoulder
      { cx: 44, cy: 40, rx: 16, ry: 15 }, // Right shoulder
      { cx: 32, cy: 18, rx: 14, ry: 13 }, // Top crest
      { cx: 32, cy: 46, rx: 16, ry: 11 }, // Bottom fill
    ];
  } else if (variant === 1) {
    // Mystical conical fir/spire tree
    lobes = [
      { cx: 32, cy: 50, rx: 22, ry: 15 }, // Bottom broad tier
      { cx: 32, cy: 36, rx: 18, ry: 14 }, // Mid tier
      { cx: 32, cy: 22, rx: 13, ry: 12 }, // Upper tier
      { cx: 32, cy: 12, rx: 7, ry: 8 },   // Tip crest
      { cx: 22, cy: 48, rx: 12, ry: 11 }, // Left flare
      { cx: 42, cy: 48, rx: 12, ry: 11 }, // Right flare
    ];
  } else {
    // Ancient sprawling mystical oak
    lobes = [
      { cx: 32, cy: 34, rx: 24, ry: 18 }, // Core dome
      { cx: 16, cy: 38, rx: 15, ry: 14 }, // Deep left lobe
      { cx: 48, cy: 38, rx: 15, ry: 14 }, // Deep right lobe
      { cx: 24, cy: 20, rx: 14, ry: 13 }, // Upper left crest
      { cx: 40, cy: 20, rx: 14, ry: 13 }, // Upper right crest
      { cx: 32, cy: 48, rx: 18, ry: 12 }, // Base lobe
    ];
  }

  // Draw foliage lobes with multi-step pixel shading
  for (let y = 4; y < 70; y += 2) {
    for (let x = 4; x < 60; x += 2) {
      // Find minimum normalized distance to any lobe
      let minNormDist = 999;
      let bestLobeY = 0;
      let inAnyLobe = false;

      for (let i = 0; i < lobes.length; i++) {
        const l = lobes[i];
        const dx = (x - l.cx) / l.rx;
        const dy = (y - l.cy) / l.ry;
        const dist = Math.hypot(dx, dy);
        if (dist <= 1.0) {
          inAnyLobe = true;
          if (dist < minNormDist) {
            minNormDist = dist;
            bestLobeY = dy; // -1 at top, +1 at bottom
          }
        }
      }

      if (inAnyLobe) {
        // Pixel noise for dappled leaf texture
        const n = Math.sin(x * 37.1 + y * 73.9) * 43758.5453;
        const jitter = (n - Math.floor(n)) * 0.35 - 0.17;
        const shadeVal = bestLobeY + jitter;

        if (shadeVal > 0.45) {
          // Deep underside shadow
          ctx.fillStyle = '#0a1329';
        } else if (shadeVal > 0.15) {
          // Shadow/dark navy foliage
          ctx.fillStyle = '#172554';
        } else if (shadeVal > -0.2) {
          // Royal blue midtones
          ctx.fillStyle = '#1d4ed8';
        } else if (shadeVal > -0.55) {
          // Vibrant moonlit cyan/azure
          ctx.fillStyle = '#0284c7';
        } else if (shadeVal > -0.78) {
          // Bright cyan highlights
          ctx.fillStyle = '#38bdf8';
        } else {
          // Top crest moonlit rim
          ctx.fillStyle = '#7dd3fc';
        }
        ctx.fillRect(x, y, 2, 2);
      }
    }
  }

  // Add sparkling leaf pixel clusters on top of each lobe
  lobes.forEach((l, idx) => {
    ctx.fillStyle = '#bae6fd';
    ctx.fillRect(l.cx - 2, l.cy - l.ry + 2, 2, 2);
    ctx.fillRect(l.cx + 2, l.cy - l.ry + 4, 2, 2);
    ctx.fillStyle = '#7dd3fc';
    ctx.fillRect(l.cx - 5, l.cy - l.ry + 5, 3, 2);
    ctx.fillRect(l.cx + 3, l.cy - l.ry + 6, 3, 2);
    if (idx % 2 === 0) {
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(l.cx, l.cy - l.ry + 3, 1, 1);
    }
  });

  const texture = new THREE.CanvasTexture(canvas);
  texture.magFilter = THREE.NearestFilter;
  texture.minFilter = THREE.NearestFilter;
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

export function createStoneWallTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 64;
  canvas.height = 64;
  const ctx = canvas.getContext('2d')!;
  ctx.imageSmoothingEnabled = false;
  ctx.fillStyle = '#334155';
  ctx.fillRect(0, 0, 64, 64);

  for (let y = 0; y < 64; y += 16) {
    ctx.fillStyle = '#1e293b';
    ctx.fillRect(0, y, 64, 2);
    const offset = (y / 16) % 2 === 0 ? 0 : 16;
    for (let x = offset; x < 64; x += 32) {
      ctx.fillRect(x, y, 2, 16);
      ctx.fillStyle = '#475569';
      ctx.fillRect(x + 2, y + 2, 12, 12);
    }
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.magFilter = THREE.NearestFilter;
  texture.minFilter = THREE.NearestFilter;
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

export function createHouseWallTexture(theme: 'hero' | 'rival'): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 64;
  canvas.height = 64;
  const ctx = canvas.getContext('2d')!;
  ctx.imageSmoothingEnabled = false;

  ctx.fillStyle = theme === 'hero' ? '#f5ede0' : '#ede8f5';
  ctx.fillRect(0, 0, 64, 64);

  ctx.fillStyle = '#332936';
  ctx.fillRect(0, 54, 64, 10);

  ctx.fillStyle = '#3b2416';
  ctx.fillRect(0, 0, 4, 54);
  ctx.fillRect(60, 0, 4, 54);
  ctx.fillRect(0, 0, 64, 4);

  const texture = new THREE.CanvasTexture(canvas);
  texture.magFilter = THREE.NearestFilter;
  texture.minFilter = THREE.NearestFilter;
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

export function createHouseSideTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 64;
  canvas.height = 64;
  const ctx = canvas.getContext('2d')!;
  ctx.imageSmoothingEnabled = false;
  ctx.fillStyle = '#f5ede0';
  ctx.fillRect(0, 0, 64, 64);

  const texture = new THREE.CanvasTexture(canvas);
  texture.magFilter = THREE.NearestFilter;
  texture.minFilter = THREE.NearestFilter;
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

export function createHouseRoofTexture(theme: 'hero' | 'rival'): THREE.Texture {
  const loader = new THREE.TextureLoader();
  const texture = loader.load('/assets/tiles/roof_hd.jpg');
  
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  
  // 2x2 Atlas: each tile is 0.5 x 0.5
  texture.repeat.set(0.5, 0.5);
  
  // Map themes to atlas quadrants (e.g., hero: 0,0, rival: 1,0)
  texture.offset.set(theme === 'hero' ? 0 : 0.5, 0); 
  
  texture.magFilter = THREE.NearestFilter;
  texture.minFilter = THREE.NearestFilter;
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

export function createLabWallTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 64;
  canvas.height = 64;
  const ctx = canvas.getContext('2d')!;
  ctx.imageSmoothingEnabled = false;
  ctx.fillStyle = '#334155';
  ctx.fillRect(0, 0, 64, 64);

  const texture = new THREE.CanvasTexture(canvas);
  texture.magFilter = THREE.NearestFilter;
  texture.minFilter = THREE.NearestFilter;
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

export function createLabRoofTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 64;
  canvas.height = 64;
  const ctx = canvas.getContext('2d')!;
  ctx.imageSmoothingEnabled = false;
  ctx.fillStyle = '#0f766e';
  ctx.fillRect(0, 0, 64, 64);

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(3, 2);
  texture.magFilter = THREE.NearestFilter;
  texture.minFilter = THREE.NearestFilter;
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

export function createCobblestoneRoadTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 64;
  canvas.height = 64;
  const ctx = canvas.getContext('2d')!;
  ctx.imageSmoothingEnabled = false;

  // Dark slate-indigo mortar base
  ctx.fillStyle = '#141d2e';
  ctx.fillRect(0, 0, 64, 64);

  // Staggered cobblestone blocks
  const rows = [
    { y: 0, h: 14, stones: [{ x: 0, w: 18 }, { x: 20, w: 22 }, { x: 44, w: 20 }] },
    { y: 16, h: 14, stones: [{ x: 0, w: 10 }, { x: 12, w: 24 }, { x: 38, w: 18 }, { x: 58, w: 6 }] },
    { y: 32, h: 14, stones: [{ x: 0, w: 22 }, { x: 24, w: 18 }, { x: 44, w: 20 }] },
    { y: 48, h: 14, stones: [{ x: 0, w: 8 }, { x: 10, w: 20 }, { x: 32, w: 22 }, { x: 56, w: 8 }] },
  ];

  rows.forEach((row, rIdx) => {
    row.stones.forEach((s, sIdx) => {
      // Cast shadow
      ctx.fillStyle = '#0b101c';
      ctx.fillRect(s.x, row.y + 1, s.w, row.h);

      // Stone base color (slate with subtle variance)
      const stoneColor = (rIdx + sIdx) % 3 === 0 ? '#38465e' : (rIdx + sIdx) % 3 === 1 ? '#435472' : '#323e54';
      ctx.fillStyle = stoneColor;
      ctx.fillRect(s.x, row.y, s.w - 1, row.h - 1);

      // Top and left bevel highlight
      ctx.fillStyle = '#677d9e';
      ctx.fillRect(s.x, row.y, s.w - 2, 2);
      ctx.fillRect(s.x, row.y, 2, row.h - 2);

      // Bright moonlit corner speck
      ctx.fillStyle = '#9fb3cf';
      ctx.fillRect(s.x + 1, row.y + 1, 2, 2);

      // Bottom and right bevel shadow
      ctx.fillStyle = '#1e293b';
      ctx.fillRect(s.x + 1, row.y + row.h - 2, s.w - 2, 1);
      ctx.fillRect(s.x + s.w - 2, row.y + 1, 1, row.h - 2);
    });
  });

  // Tiny cyan moss & weed specks in the mortar joints
  const mossJoints = [
    { x: 18, y: 8 }, { x: 42, y: 12 }, { x: 10, y: 24 }, { x: 36, y: 28 },
    { x: 22, y: 40 }, { x: 42, y: 44 }, { x: 30, y: 56 }, { x: 54, y: 60 }
  ];
  mossJoints.forEach(m => {
    ctx.fillStyle = '#0284c7';
    ctx.fillRect(m.x, m.y, 2, 2);
    ctx.fillStyle = '#38bdf8';
    ctx.fillRect(m.x, m.y, 1, 1);
  });

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(4, 4);
  texture.magFilter = THREE.NearestFilter;
  texture.minFilter = THREE.NearestFilter;
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

export function createFenceTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 32;
  canvas.height = 32;
  const ctx = canvas.getContext('2d')!;
  ctx.imageSmoothingEnabled = false;
  ctx.clearRect(0, 0, 32, 32);

  // Horizontal rails
  ctx.fillStyle = '#64748b';
  ctx.fillRect(0, 11, 32, 4);
  ctx.fillRect(0, 21, 32, 4);
  ctx.fillStyle = '#cbd5e1';
  ctx.fillRect(0, 11, 32, 2);
  ctx.fillRect(0, 21, 32, 2);

  // Two vertical pickets with pointed tops
  const pickets = [6, 20];
  pickets.forEach(px => {
    // Drop shadow
    ctx.fillStyle = 'rgba(10, 16, 32, 0.4)';
    ctx.fillRect(px + 1, 6, 7, 24);

    // Main picket
    ctx.fillStyle = '#94a3b8';
    ctx.fillRect(px, 7, 6, 23);
    ctx.fillStyle = '#e2e8f0';
    ctx.fillRect(px, 7, 5, 23);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(px, 7, 2, 23);

    // Pointed top
    ctx.fillStyle = '#e2e8f0';
    ctx.fillRect(px + 1, 5, 4, 2);
    ctx.fillRect(px + 2, 4, 2, 1);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(px + 1, 5, 2, 2);
    ctx.fillRect(px + 2, 4, 1, 1);

    // Nails
    ctx.fillStyle = '#334155';
    ctx.fillRect(px + 2, 12, 2, 2);
    ctx.fillRect(px + 2, 22, 2, 2);
  });

  const texture = new THREE.CanvasTexture(canvas);
  texture.magFilter = THREE.NearestFilter;
  texture.minFilter = THREE.NearestFilter;
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

export function createHedgeTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 32;
  canvas.height = 32;
  const ctx = canvas.getContext('2d')!;
  ctx.imageSmoothingEnabled = false;
  ctx.clearRect(0, 0, 32, 32);

  // Base hedge shadow
  ctx.fillStyle = 'rgba(10, 16, 32, 0.5)';
  ctx.beginPath();
  ctx.ellipse(16, 28, 14, 4, 0, 0, Math.PI * 2);
  ctx.fill();

  // Dark indigo-blue underside
  ctx.fillStyle = '#0b1329';
  ctx.beginPath();
  ctx.arc(16, 18, 12, 0, Math.PI * 2);
  ctx.fill();

  // Cobalt / sapphire foliage body
  ctx.fillStyle = '#1e3a8a';
  ctx.beginPath();
  ctx.arc(16, 16, 11, 0, Math.PI * 2);
  ctx.fill();

  // Cyan moonlit foliage highlights
  ctx.fillStyle = '#0284c7';
  ctx.beginPath();
  ctx.arc(14, 13, 8, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = '#38bdf8';
  ctx.beginPath();
  ctx.arc(13, 10, 5, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = '#7dd3fc';
  ctx.fillRect(11, 8, 3, 2);
  ctx.fillRect(15, 7, 2, 2);

  const texture = new THREE.CanvasTexture(canvas);
  texture.magFilter = THREE.NearestFilter;
  texture.minFilter = THREE.NearestFilter;
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

export function createFlowerbedTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 32;
  canvas.height = 32;
  const ctx = canvas.getContext('2d')!;
  ctx.imageSmoothingEnabled = false;

  // Dark fertile earth
  ctx.fillStyle = '#16192b';
  ctx.fillRect(0, 0, 32, 32);

  // Stone border
  ctx.fillStyle = '#475569';
  ctx.fillRect(0, 0, 32, 2);
  ctx.fillRect(0, 30, 32, 2);
  ctx.fillRect(0, 0, 2, 32);
  ctx.fillRect(30, 0, 2, 32);
  ctx.fillStyle = '#94a3b8';
  ctx.fillRect(0, 0, 32, 1);
  ctx.fillRect(0, 0, 1, 32);

  // Soil details
  ctx.fillStyle = '#1e2540';
  for (let i = 0; i < 20; i++) {
    const rx = 3 + (i * 7) % 26;
    const ry = 3 + (i * 11) % 26;
    ctx.fillRect(rx, ry, 2, 2);
  }

  // Colorful blooms (pink, cyan, gold)
  const flowers = [
    { x: 6, y: 7, c: '#f472b6', center: '#fef08a' },
    { x: 18, y: 6, c: '#38bdf8', center: '#ffffff' },
    { x: 11, y: 15, c: '#fbbf24', center: '#ffffff' },
    { x: 23, y: 14, c: '#f472b6', center: '#fef08a' },
    { x: 7, y: 23, c: '#38bdf8', center: '#ffffff' },
    { x: 20, y: 22, c: '#ec4899', center: '#fef08a' },
  ];
  flowers.forEach(f => {
    ctx.fillStyle = '#1e3a8a';
    ctx.fillRect(f.x - 1, f.y - 1, 5, 5);
    ctx.fillStyle = f.c;
    ctx.fillRect(f.x, f.y - 1, 3, 5);
    ctx.fillRect(f.x - 1, f.y, 5, 3);
    ctx.fillStyle = f.center;
    ctx.fillRect(f.x + 1, f.y + 1, 1, 1);
  });

  const texture = new THREE.CanvasTexture(canvas);
  texture.magFilter = THREE.NearestFilter;
  texture.minFilter = THREE.NearestFilter;
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

export function createSignpostTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 32;
  canvas.height = 32;
  const ctx = canvas.getContext('2d')!;
  ctx.imageSmoothingEnabled = false;
  ctx.clearRect(0, 0, 32, 32);

  // Ground shadow
  ctx.fillStyle = 'rgba(10, 16, 32, 0.4)';
  ctx.beginPath();
  ctx.ellipse(16, 30, 8, 2, 0, 0, Math.PI * 2);
  ctx.fill();

  // Wooden vertical post
  ctx.fillStyle = '#27170a';
  ctx.fillRect(14, 8, 4, 22);
  ctx.fillStyle = '#451a03';
  ctx.fillRect(14, 8, 3, 22);
  ctx.fillStyle = '#78350f';
  ctx.fillRect(15, 8, 2, 22);

  // Signboard pointing right
  ctx.fillStyle = '#27170a';
  ctx.fillRect(4, 5, 22, 10);
  ctx.fillRect(26, 7, 2, 6);
  ctx.fillRect(28, 9, 2, 2);

  ctx.fillStyle = '#78350f';
  ctx.fillRect(5, 6, 20, 8);
  ctx.fillRect(25, 8, 2, 4);
  ctx.fillRect(27, 9, 1, 2);

  ctx.fillStyle = '#92400e';
  ctx.fillRect(5, 6, 20, 2);

  // Carved runic text lines on sign
  ctx.fillStyle = '#fbbf24';
  ctx.fillRect(8, 9, 12, 1);
  ctx.fillRect(8, 11, 8, 1);

  // Metal nails
  ctx.fillStyle = '#94a3b8';
  ctx.fillRect(15, 7, 2, 2);
  ctx.fillRect(15, 12, 2, 2);

  const texture = new THREE.CanvasTexture(canvas);
  texture.magFilter = THREE.NearestFilter;
  texture.minFilter = THREE.NearestFilter;
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

export function createStreetLampTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 32;
  canvas.height = 48;
  const ctx = canvas.getContext('2d')!;
  ctx.imageSmoothingEnabled = false;
  ctx.clearRect(0, 0, 32, 48);

  // Ground shadow
  ctx.fillStyle = 'rgba(10, 16, 32, 0.4)';
  ctx.beginPath();
  ctx.ellipse(16, 46, 8, 2, 0, 0, Math.PI * 2);
  ctx.fill();

  // Wrought iron base & post
  ctx.fillStyle = '#0f172a';
  ctx.fillRect(12, 43, 8, 3);
  ctx.fillRect(14, 18, 4, 25);
  ctx.fillStyle = '#334155';
  ctx.fillRect(15, 18, 2, 25);

  // Lamp top cap & bracket
  ctx.fillStyle = '#0f172a';
  ctx.fillRect(10, 6, 12, 3);
  ctx.fillRect(12, 4, 8, 2);
  ctx.fillRect(15, 2, 2, 2);
  ctx.fillRect(10, 16, 12, 2);

  // Glass lantern chamber with celestial cyan & gold glow
  ctx.fillStyle = '#38bdf8';
  ctx.fillRect(11, 9, 10, 7);
  ctx.fillStyle = '#fef08a';
  ctx.fillRect(13, 10, 6, 5);
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(15, 11, 2, 3);

  // Lantern glass frame bars
  ctx.fillStyle = '#0f172a';
  ctx.fillRect(11, 9, 1, 7);
  ctx.fillRect(20, 9, 1, 7);
  ctx.fillRect(15, 9, 1, 7);

  const texture = new THREE.CanvasTexture(canvas);
  texture.magFilter = THREE.NearestFilter;
  texture.minFilter = THREE.NearestFilter;
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

export function createWoodPlankTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 64;
  canvas.height = 64;
  const ctx = canvas.getContext('2d')!;
  ctx.imageSmoothingEnabled = false;
  ctx.fillStyle = '#78350f';
  ctx.fillRect(0, 0, 64, 64);

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(2, 2);
  texture.magFilter = THREE.NearestFilter;
  texture.minFilter = THREE.NearestFilter;
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

export function createSoulDollTexture(color: string): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 32;
  canvas.height = 32;
  const ctx = canvas.getContext('2d')!;
  ctx.imageSmoothingEnabled = false;
  ctx.clearRect(0, 0, 32, 32);

  // Outer ethereal aura particles
  ctx.fillStyle = color;
  ctx.globalAlpha = 0.45;
  ctx.beginPath();
  ctx.arc(16, 16, 12, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = 1.0;

  // Faceted soul crystal diamond (width 16, height 22)
  // Left shadow facet
  ctx.fillStyle = '#0f172a';
  ctx.beginPath();
  ctx.moveTo(16, 5);
  ctx.lineTo(8, 16);
  ctx.lineTo(16, 27);
  ctx.lineTo(16, 16);
  ctx.closePath();
  ctx.fill();

  // Left mid facet
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(16, 5);
  ctx.lineTo(9, 16);
  ctx.lineTo(16, 26);
  ctx.lineTo(16, 16);
  ctx.closePath();
  ctx.fill();

  // Right light facet
  ctx.fillStyle = '#ffffff';
  ctx.globalAlpha = 0.6;
  ctx.beginPath();
  ctx.moveTo(16, 5);
  ctx.lineTo(23, 16);
  ctx.lineTo(16, 26);
  ctx.lineTo(16, 16);
  ctx.closePath();
  ctx.fill();
  ctx.globalAlpha = 1.0;

  // Inner radiant core
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(14, 13, 4, 5);
  ctx.fillRect(13, 14, 6, 3);

  // Floating sparkle accents
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(6, 8, 2, 2);
  ctx.fillRect(24, 7, 2, 2);
  ctx.fillRect(5, 22, 2, 2);
  ctx.fillRect(25, 23, 2, 2);

  const texture = new THREE.CanvasTexture(canvas);
  texture.magFilter = THREE.NearestFilter;
  texture.minFilter = THREE.NearestFilter;
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

export function createSpiritTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 32;
  canvas.height = 32;
  const ctx = canvas.getContext('2d')!;
  ctx.imageSmoothingEnabled = false;
  ctx.clearRect(0, 0, 32, 32);

  // Outer glow aura
  ctx.fillStyle = 'rgba(56, 189, 248, 0.4)';
  ctx.beginPath();
  ctx.arc(16, 14, 12, 0, Math.PI * 2);
  ctx.fill();

  // Spirit body
  ctx.fillStyle = '#0284c7';
  ctx.beginPath();
  ctx.arc(16, 14, 8, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = '#38bdf8';
  ctx.beginPath();
  ctx.arc(16, 13, 6, 0, Math.PI * 2);
  ctx.fill();

  // White core
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.arc(16, 12, 3, 0, Math.PI * 2);
  ctx.fill();

  // Ethereal wispy tail trailing below
  ctx.fillStyle = '#38bdf8';
  ctx.fillRect(15, 20, 2, 5);
  ctx.fillRect(14, 22, 4, 3);
  ctx.fillStyle = '#7dd3fc';
  ctx.fillRect(15, 24, 2, 4);

  const texture = new THREE.CanvasTexture(canvas);
  texture.magFilter = THREE.NearestFilter;
  texture.minFilter = THREE.NearestFilter;
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

export function createMoonTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 64;
  canvas.height = 64;
  const ctx = canvas.getContext('2d')!;
  ctx.imageSmoothingEnabled = false;
  ctx.clearRect(0, 0, 64, 64);

  // Atmospheric halo
  ctx.fillStyle = 'rgba(224, 242, 254, 0.3)';
  ctx.beginPath();
  ctx.arc(32, 32, 28, 0, Math.PI * 2);
  ctx.fill();

  // Main lunar disc
  ctx.fillStyle = '#e2e8f0';
  ctx.beginPath();
  ctx.arc(32, 32, 22, 0, Math.PI * 2);
  ctx.fill();

  // Moon craters (mares)
  ctx.fillStyle = '#94a3b8';
  ctx.beginPath();
  ctx.arc(26, 26, 5, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(36, 35, 6, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(28, 40, 3, 0, Math.PI * 2);
  ctx.fill();

  // Highlight rim
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.arc(30, 30, 20, Math.PI * 0.7, Math.PI * 1.8);
  ctx.lineWidth = 2;
  ctx.strokeStyle = '#ffffff';
  ctx.stroke();

  const texture = new THREE.CanvasTexture(canvas);
  texture.magFilter = THREE.NearestFilter;
  texture.minFilter = THREE.NearestFilter;
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

export function createSparkleTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 16;
  canvas.height = 16;
  const ctx = canvas.getContext('2d')!;
  ctx.imageSmoothingEnabled = false;
  ctx.clearRect(0, 0, 16, 16);

  // 4-point star sparkle
  ctx.fillStyle = '#38bdf8';
  ctx.fillRect(7, 1, 2, 14);
  ctx.fillRect(1, 7, 14, 2);

  ctx.fillStyle = '#7dd3fc';
  ctx.fillRect(7, 3, 2, 10);
  ctx.fillRect(3, 7, 10, 2);

  // Bright core
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(6, 6, 4, 4);

  const texture = new THREE.CanvasTexture(canvas);
  texture.magFilter = THREE.NearestFilter;
  texture.minFilter = THREE.NearestFilter;
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

export function createDustTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 16;
  canvas.height = 16;
  const ctx = canvas.getContext('2d')!;
  ctx.imageSmoothingEnabled = false;
  ctx.fillStyle = '#e8b84a';
  ctx.fillRect(4, 4, 8, 8);

  const texture = new THREE.CanvasTexture(canvas);
  texture.magFilter = THREE.NearestFilter;
  texture.minFilter = THREE.NearestFilter;
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

export function createPropsSpriteTexture(type: 'chest' | 'pot' | 'barrel' | 'crate'): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 32;
  canvas.height = 32;
  const ctx = canvas.getContext('2d')!;
  ctx.imageSmoothingEnabled = false;
  ctx.clearRect(0, 0, 32, 32);

  if (type === 'chest') {
    ctx.fillStyle = '#78350f';
    ctx.fillRect(8, 12, 16, 12);
    ctx.fillStyle = '#92400e';
    ctx.fillRect(8, 10, 16, 4);
    ctx.fillStyle = '#fbbf24';
    ctx.fillRect(14, 15, 4, 4);
  } else if (type === 'pot') {
    ctx.fillStyle = '#3b82f6';
    ctx.fillRect(10, 12, 12, 16);
    ctx.fillRect(12, 8, 8, 4);
    ctx.fillStyle = '#93c5fd';
    ctx.fillRect(12, 14, 3, 10);
  } else if (type === 'barrel') {
    ctx.fillStyle = '#78350f';
    ctx.fillRect(10, 10, 12, 18);
    ctx.fillStyle = '#1e293b';
    ctx.fillRect(9, 14, 14, 2);
    ctx.fillRect(9, 22, 14, 2);
  } else if (type === 'crate') {
    ctx.fillStyle = '#92400e';
    ctx.fillRect(8, 10, 16, 16);
    ctx.fillStyle = '#451a03';
    ctx.fillRect(8, 10, 16, 2);
    ctx.fillRect(8, 24, 16, 2);
    ctx.fillRect(8, 10, 2, 16);
    ctx.fillRect(22, 10, 2, 16);
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.magFilter = THREE.NearestFilter;
  texture.minFilter = THREE.NearestFilter;
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

export function createStripedAwningTexture(color1: string = '#b91c1c', color2: string = '#fef08a'): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 32;
  canvas.height = 32;
  const ctx = canvas.getContext('2d')!;
  ctx.imageSmoothingEnabled = false;

  for (let x = 0; x < 32; x += 8) {
    ctx.fillStyle = color1;
    ctx.fillRect(x, 0, 4, 32);
    ctx.fillStyle = color2;
    ctx.fillRect(x + 4, 0, 4, 32);
  }

  // Scalloped bottom edge fringe
  ctx.fillStyle = '#ffffff';
  for (let x = 0; x < 32; x += 4) {
    ctx.fillRect(x, 29, 3, 3);
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(2, 1);
  texture.magFilter = THREE.NearestFilter;
  texture.minFilter = THREE.NearestFilter;
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

export function createRunicGlyphTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 32;
  canvas.height = 32;
  const ctx = canvas.getContext('2d')!;
  ctx.imageSmoothingEnabled = false;
  ctx.clearRect(0, 0, 32, 32);

  // Outer glowing runic circle
  ctx.fillStyle = '#fbbf24';
  ctx.beginPath();
  ctx.arc(16, 16, 13, 0, Math.PI * 2);
  ctx.lineWidth = 2;
  ctx.strokeStyle = '#f59e0b';
  ctx.stroke();

  // Marionette strings / cross rune
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(15, 6, 2, 20);
  ctx.fillRect(6, 15, 20, 2);

  // Core soul crystal spark
  ctx.fillStyle = '#38bdf8';
  ctx.fillRect(14, 14, 4, 4);

  const texture = new THREE.CanvasTexture(canvas);
  texture.magFilter = THREE.NearestFilter;
  texture.minFilter = THREE.NearestFilter;
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

/**
 * Generates an authentic normal map from a source HTMLCanvasElement using Sobel gradient differentiation.
 */
export function createNormalMapFromCanvas(sourceCanvas: HTMLCanvasElement, strength: number = 3.0): THREE.CanvasTexture {
  const w = sourceCanvas.width;
  const h = sourceCanvas.height;
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d')!;
  ctx.imageSmoothingEnabled = false;

  const srcCtx = sourceCanvas.getContext('2d')!;
  const imgData = srcCtx.getImageData(0, 0, w, h);
  const data = imgData.data;

  const outData = ctx.createImageData(w, h);
  const out = outData.data;

  const getLum = (x: number, y: number) => {
    const cx = (x + w) % w;
    const cy = (y + h) % h;
    const i = (cy * w + cx) * 4;
    return (data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114) / 255;
  };

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const idx = (y * w + x) * 4;
      const tl = getLum(x - 1, y - 1);
      const l  = getLum(x - 1, y);
      const bl = getLum(x - 1, y + 1);
      const t  = getLum(x, y - 1);
      const b  = getLum(x, y + 1);
      const tr = getLum(x + 1, y - 1);
      const r  = getLum(x + 1, y);
      const br = getLum(x + 1, y + 1);

      const dX = (tr + 2 * r + br) - (tl + 2 * l + bl);
      const dY = (bl + 2 * b + br) - (tl + 2 * t + tr);

      const nx = -dX * strength;
      const ny = -dY * strength;
      const nz = 1.0;
      const len = Math.hypot(nx, ny, nz);

      out[idx]     = Math.round(((nx / len) * 0.5 + 0.5) * 255);
      out[idx + 1] = Math.round(((ny / len) * 0.5 + 0.5) * 255);
      out[idx + 2] = Math.round(((nz / len) * 0.5 + 0.5) * 255);
      out[idx + 3] = 255;
    }
  }

  ctx.putImageData(outData, 0, 0);
  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.magFilter = THREE.NearestFilter;
  texture.minFilter = THREE.NearestFilter;
  texture.colorSpace = THREE.NoColorSpace;
  return texture;
}

/**
 * Creates a procedural stone block normal map for walls and foundations.
 */
export function createStoneWallNormalMap(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 64;
  canvas.height = 64;
  const ctx = canvas.getContext('2d')!;
  ctx.imageSmoothingEnabled = false;

  // Mid-gray neutral normal (128, 128, 255)
  ctx.fillStyle = '#8080ff';
  ctx.fillRect(0, 0, 64, 64);

  // Deep mortar grooves
  ctx.fillStyle = '#4040ff';
  for (let y = 0; y < 64; y += 16) {
    ctx.fillRect(0, y, 64, 2);
  }
  for (let y = 0; y < 64; y += 16) {
    const offset = (y / 16) % 2 === 0 ? 0 : 16;
    for (let x = offset; x < 64; x += 32) {
      ctx.fillRect(x, y, 2, 16);
    }
  }

  // Stone face bevels
  ctx.fillStyle = '#a0a0ff';
  for (let y = 0; y < 64; y += 16) {
    const offset = (y / 16) % 2 === 0 ? 0 : 16;
    for (let x = offset; x < 64; x += 32) {
      ctx.fillRect(x + 2, y + 2, 28, 12);
    }
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.magFilter = THREE.NearestFilter;
  texture.minFilter = THREE.NearestFilter;
  texture.colorSpace = THREE.NoColorSpace;
  return texture;
}

/**
 * Creates a procedural wood plank normal map for walls.
 */
export function createWoodWallNormalMap(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 64;
  canvas.height = 64;
  const ctx = canvas.getContext('2d')!;
  ctx.imageSmoothingEnabled = false;

  // Mid-gray neutral normal (128, 128, 255)
  ctx.fillStyle = '#8080ff';
  ctx.fillRect(0, 0, 64, 64);

  // Planks
  ctx.fillStyle = '#4040ff';
  for (let y = 0; y < 64; y += 16) {
    ctx.fillRect(0, y, 64, 2);
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.magFilter = THREE.NearestFilter;
  texture.minFilter = THREE.NearestFilter;
  texture.colorSpace = THREE.NoColorSpace;
  return texture;
}

/**
 * Creates pixel-art clusters of fallen autumn leaves (crimson, scarlet, amber)
 * inspired by autumnal dark RPG aesthetics.
 */
export function createFallenAutumnLeavesTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 32;
  canvas.height = 32;
  const ctx = canvas.getContext('2d')!;
  ctx.imageSmoothingEnabled = false;
  ctx.clearRect(0, 0, 32, 32);

  const leaves = [
    { x: 5, y: 7, color: '#dc2626', shadow: '#450a0a', size: 4 },
    { x: 14, y: 4, color: '#ea580c', shadow: '#7c2d12', size: 3 },
    { x: 22, y: 8, color: '#b91c1c', shadow: '#450a0a', size: 5 },
    { x: 8, y: 16, color: '#f59e0b', shadow: '#78350f', size: 4 },
    { x: 19, y: 15, color: '#ef4444', shadow: '#7f1d1d', size: 4 },
    { x: 25, y: 20, color: '#c2410c', shadow: '#431407', size: 3 },
    { x: 6, y: 24, color: '#dc2626', shadow: '#450a0a', size: 5 },
    { x: 15, y: 23, color: '#fbbf24', shadow: '#92400e', size: 4 },
    { x: 22, y: 26, color: '#991b1b', shadow: '#450a0a', size: 4 },
  ];

  leaves.forEach(l => {
    // Drop shadow
    ctx.fillStyle = l.shadow;
    ctx.fillRect(l.x + 1, l.y + 1, l.size, l.size);
    // Leaf base
    ctx.fillStyle = l.color;
    ctx.fillRect(l.x, l.y, l.size, l.size);
    // Leaf tip point
    ctx.fillRect(l.x + 1, l.y - 1, l.size - 2, 1);
    ctx.fillRect(l.x - 1, l.y + 1, 1, l.size - 2);
    // Bright vein highlight
    ctx.fillStyle = '#fef08a';
    ctx.fillRect(l.x + 1, l.y + 1, 1, 1);
  });

  const texture = new THREE.CanvasTexture(canvas);
  texture.magFilter = THREE.NearestFilter;
  texture.minFilter = THREE.NearestFilter;
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

/**
 * Creates pixel-art wild blue flowers that grow in stone cracks and terrace borders.
 */
export function createCobbleFlowersTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 32;
  canvas.height = 32;
  const ctx = canvas.getContext('2d')!;
  ctx.imageSmoothingEnabled = false;
  ctx.clearRect(0, 0, 32, 32);

  const flowers = [
    { x: 6, y: 8, petal: '#38bdf8', center: '#fef08a', stem: '#15803d' },
    { x: 16, y: 6, petal: '#60a5fa', center: '#ffffff', stem: '#166534' },
    { x: 23, y: 12, petal: '#818cf8', center: '#fef08a', stem: '#15803d' },
    { x: 9, y: 18, petal: '#0ea5e9', center: '#fde047', stem: '#14532d' },
    { x: 18, y: 22, petal: '#38bdf8', center: '#ffffff', stem: '#15803d' },
  ];

  flowers.forEach(f => {
    // Stem & Leaf
    ctx.fillStyle = f.stem;
    ctx.fillRect(f.x + 1, f.y + 3, 2, 4);
    ctx.fillRect(f.x - 1, f.y + 5, 2, 2);
    ctx.fillRect(f.x + 3, f.y + 4, 2, 2);

    // Petals
    ctx.fillStyle = f.petal;
    ctx.fillRect(f.x, f.y - 2, 4, 2); // Top
    ctx.fillRect(f.x, f.y + 4, 4, 2); // Bottom
    ctx.fillRect(f.x - 2, f.y, 2, 4); // Left
    ctx.fillRect(f.x + 4, f.y, 2, 4); // Right

    // Center
    ctx.fillStyle = f.center;
    ctx.fillRect(f.x, f.y, 4, 4);
  });

  const texture = new THREE.CanvasTexture(canvas);
  texture.magFilter = THREE.NearestFilter;
  texture.minFilter = THREE.NearestFilter;
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

/**
 * Creates a round wooden tavern/patio table texture with dark timber planks and iron banding.
 */
export function createTavernTableTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 64;
  canvas.height = 64;
  const ctx = canvas.getContext('2d')!;
  ctx.imageSmoothingEnabled = false;
  ctx.clearRect(0, 0, 64, 64);

  // Outer dark shadow
  ctx.fillStyle = '#0f172a';
  ctx.beginPath();
  ctx.arc(32, 33, 29, 0, Math.PI * 2);
  ctx.fill();

  // Iron rim band
  ctx.fillStyle = '#334155';
  ctx.beginPath();
  ctx.arc(32, 32, 28, 0, Math.PI * 2);
  ctx.fill();

  // Wood tabletop
  ctx.fillStyle = '#5a3825';
  ctx.beginPath();
  ctx.arc(32, 32, 25, 0, Math.PI * 2);
  ctx.fill();

  // Wood plank lines
  ctx.fillStyle = '#3f2516';
  for (let y = 14; y <= 50; y += 8) {
    ctx.fillRect(10, y, 44, 2);
  }

  // Wood grain highlights
  ctx.fillStyle = '#78462b';
  for (let y = 11; y <= 47; y += 8) {
    ctx.fillRect(12, y, 40, 2);
  }

  // Iron center boss
  ctx.fillStyle = '#1e293b';
  ctx.beginPath();
  ctx.arc(32, 32, 5, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#94a3b8';
  ctx.fillRect(31, 31, 2, 2);

  const texture = new THREE.CanvasTexture(canvas);
  texture.magFilter = THREE.NearestFilter;
  texture.minFilter = THREE.NearestFilter;
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

/**
 * Pixel-art drifting autumn leaf sprite for 3D atmospheric wind particles.
 */
export function createSingleAutumnLeafTexture(colorVariant: 'crimson' | 'amber'): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 16;
  canvas.height = 16;
  const ctx = canvas.getContext('2d')!;
  ctx.imageSmoothingEnabled = false;
  ctx.clearRect(0, 0, 16, 16);

  const isCrimson = colorVariant === 'crimson';
  const mainCol = isCrimson ? '#ef4444' : '#f59e0b';
  const darkCol = isCrimson ? '#991b1b' : '#b45309';
  const lightCol = isCrimson ? '#fca5a5' : '#fef08a';
  const stemCol = '#78350f';

  // Maple leaf silhouette
  ctx.fillStyle = stemCol;
  ctx.fillRect(8, 12, 1, 3); // stem

  ctx.fillStyle = darkCol;
  ctx.fillRect(5, 7, 7, 5); // core shadow
  ctx.fillRect(4, 8, 9, 3);

  ctx.fillStyle = mainCol;
  ctx.fillRect(6, 6, 5, 5);
  ctx.fillRect(7, 3, 3, 4); // top lobe
  ctx.fillRect(3, 7, 3, 3); // left lobe
  ctx.fillRect(11, 7, 3, 3); // right lobe

  // Points/serrations
  ctx.fillRect(8, 2, 1, 1);
  ctx.fillRect(2, 6, 1, 1);
  ctx.fillRect(14, 6, 1, 1);

  // Vein highlight
  ctx.fillStyle = lightCol;
  ctx.fillRect(8, 5, 1, 4);
  ctx.fillRect(7, 7, 1, 1);
  ctx.fillRect(9, 7, 1, 1);

  const leafTex = new THREE.CanvasTexture(canvas);
  leafTex.magFilter = THREE.NearestFilter;
  leafTex.minFilter = THREE.NearestFilter;
  leafTex.colorSpace = THREE.SRGBColorSpace;
  return leafTex;
}

/**
 * Atmospheric soft radial amber glow for street lamps and braziers.
 */
export function createLanternHaloTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 64;
  canvas.height = 64;
  const ctx = canvas.getContext('2d')!;
  ctx.clearRect(0, 0, 64, 64);

  const grad = ctx.createRadialGradient(32, 32, 0, 32, 32, 31);
  grad.addColorStop(0.0, 'rgba(254, 240, 138, 0.75)');
  grad.addColorStop(0.18, 'rgba(245, 158, 11, 0.42)');
  grad.addColorStop(0.45, 'rgba(217, 119, 6, 0.15)');
  grad.addColorStop(0.75, 'rgba(180, 83, 9, 0.04)');
  grad.addColorStop(1.0, 'rgba(180, 83, 9, 0.0)');

  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.arc(32, 32, 31, 0, Math.PI * 2);
  ctx.fill();

  const haloTex = new THREE.CanvasTexture(canvas);
  haloTex.magFilter = THREE.LinearFilter;
  haloTex.minFilter = THREE.LinearFilter;
  haloTex.colorSpace = THREE.SRGBColorSpace;
  return haloTex;
}



