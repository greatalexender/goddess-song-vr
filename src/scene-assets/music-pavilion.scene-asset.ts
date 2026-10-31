/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import {
  createSceneMaterial,
  createScenePrimitiveObject,
  Group,
} from '@iwsdk/core';
import { createGoddessLamp } from './garden.scene-asset.js';

/**
 * 音乐亭（空间 6 · 女神之歌之家），全部程序化低模生成。
 *
 * 与莲花亭的视觉分工：莲花亭是八边石台、六根深红柱、陡红锥顶的
 * 「重」亭；音乐亭反着来——圆台、四根细浅柱、浅色缓坡伞顶，更轻、
 * 更敞，亭心是一块平整的舞池地面（浅木圆盘 + 一圈金环），留给
 * 「听与舞」。亭后一盏派生自 goddess-lamp 的灯：**不配 PointLight**
 * （全场点光源守恒 4 盏已满），灯球的 emissive 由 ArcSystem 的
 * 6 号灯光绑定随段落呼吸驱动（见 arc-system.ts 的 setupLamps）。
 *
 * 本地朝向：-Z 为亭的正面（来客方向），灯在 +Z 亭后。场景编排
 * （位置/转角）在 public/scenes/main.iwsdk.scene.json。
 */

const platformMaterial = createSceneMaterial({
  id: 'music-pavilion-platform',
  model: 'standard',
  baseColor: '#A79C86',
  roughness: 0.95,
});

const danceFloorMaterial = createSceneMaterial({
  id: 'music-pavilion-dance-floor',
  model: 'standard',
  baseColor: '#9A744E',
  roughness: 0.75,
});

const columnMaterial = createSceneMaterial({
  id: 'music-pavilion-column',
  model: 'standard',
  baseColor: '#CBB489',
  roughness: 0.8,
});

const canopyMaterial = createSceneMaterial({
  id: 'music-pavilion-canopy',
  model: 'standard',
  baseColor: '#E3D3AC',
  roughness: 0.6,
});

const goldMaterial = createSceneMaterial({
  id: 'music-pavilion-gold',
  model: 'standard',
  baseColor: '#C9A227',
  roughness: 0.35,
  metalness: 0.85,
});

export function createMusicPavilion(): Group {
  const pavilion = new Group();

  // 圆台基座：比莲花亭的八边台矮、圆、浅。
  const platform = createScenePrimitiveObject(
    {
      geometry: { type: 'cylinder', radius: 2.45, height: 0.09, segments: 24 },
    },
    platformMaterial,
  );
  platform.position.y = 0.045;
  pavilion.add(platform);

  // 舞池：亭心一块平整的浅木圆盘，边缘一圈金环收口。
  const danceFloor = createScenePrimitiveObject(
    {
      geometry: { type: 'cylinder', radius: 1.8, height: 0.03, segments: 24 },
    },
    danceFloorMaterial,
  );
  danceFloor.position.y = 0.105;
  pavilion.add(danceFloor);

  const floorTrim = createScenePrimitiveObject(
    {
      geometry: {
        type: 'torus',
        radius: 1.8,
        tube: 0.02,
        radialSegments: 8,
        tubularSegments: 40,
      },
    },
    goldMaterial,
  );
  floorTrim.rotation.x = Math.PI / 2;
  floorTrim.position.y = 0.12;
  pavilion.add(floorTrim);

  // 四根细柱（莲花亭是六根）：撑起更敞的口面。
  const floorTopY = 0.12;
  const columnHeight = 2.25;
  for (let i = 0; i < 4; i++) {
    const angle = (i / 4) * Math.PI * 2 + Math.PI / 4;
    const column = createScenePrimitiveObject(
      {
        geometry: {
          type: 'cylinder',
          radius: 0.045,
          height: columnHeight,
          segments: 8,
        },
      },
      columnMaterial,
    );
    column.position.set(
      Math.cos(angle) * 2.0,
      floorTopY + columnHeight / 2,
      Math.sin(angle) * 2.0,
    );
    pavilion.add(column);
  }

  // 伞顶：浅色缓坡锥（莲花亭是陡红锥），檐下一圈金环，顶一颗金珠。
  const canopyBaseY = floorTopY + columnHeight;
  const canopy = createScenePrimitiveObject(
    { geometry: { type: 'cone', radius: 2.6, height: 0.55, segments: 24 } },
    canopyMaterial,
  );
  canopy.position.y = canopyBaseY + 0.275;
  pavilion.add(canopy);

  const canopyTrim = createScenePrimitiveObject(
    {
      geometry: {
        type: 'torus',
        radius: 2.05,
        tube: 0.03,
        radialSegments: 8,
        tubularSegments: 40,
      },
    },
    goldMaterial,
  );
  canopyTrim.rotation.x = Math.PI / 2;
  canopyTrim.position.y = canopyBaseY + 0.02;
  pavilion.add(canopyTrim);

  const finial = createScenePrimitiveObject(
    { geometry: { type: 'sphere', radius: 0.07, segments: 12 } },
    goldMaterial,
  );
  finial.position.y = canopyBaseY + 0.55 + 0.04;
  pavilion.add(finial);

  // 亭后一盏灯（仅 emissive 灯球，无点光源，理由见文件头）。
  const lamp = createGoddessLamp({ bulbEmissiveIntensity: 2.2 });
  lamp.position.set(0, 0.09, 1.65);
  pavilion.add(lamp);

  return pavilion;
}
