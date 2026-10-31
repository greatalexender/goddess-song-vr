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
 * 莲花亭（空间 1 · 呼唤）与其前的莲池，全部程序化低模生成。
 *
 * 亭：八边石台 + 六根细柱 + 红色锥顶（金色压边环与顶珠），亭中一盏
 * 派生自 goddess-lamp 的灯（亮度由 lampIntensity 参数预留给空间音频
 * 钩子，静态阶段为点亮态；真正的照亮由场景节点上的 PointLight 提供）。
 * 池：石圈 + 一片「涟漪水面」——用 Lathe 剖面的正弦起伏做出顶点波纹，
 * 靠晨光方向光打出法线明暗，不用贴图、不用逐帧动画，是本阶段最便宜的
 * 水面方案。水面之上薄雾两层（极低透明度的暖白色薄盘），与方向光
 * 一起近似「暖色雾」——IWSDK 场景格式没有 Fog 组件，只能如此近似。
 *
 * 莲花 6 朵，位置/朝向/大小全部写死（资产清单在双 realm 求值，必须
 * 确定性，禁用随机数）：五瓣低模锥瓣 + 发光花心 + 一片莲叶。
 */

const stoneMaterial = createSceneMaterial({
  id: 'lotus-pavilion-stone',
  model: 'standard',
  baseColor: '#8A8378',
  roughness: 0.95,
});

const columnMaterial = createSceneMaterial({
  id: 'lotus-pavilion-column',
  model: 'standard',
  baseColor: '#6E2A22',
  roughness: 0.7,
});

const roofMaterial = createSceneMaterial({
  id: 'lotus-pavilion-roof',
  model: 'standard',
  baseColor: '#9C3427',
  roughness: 0.55,
  metalness: 0.2,
});

const goldMaterial = createSceneMaterial({
  id: 'lotus-pavilion-gold',
  model: 'standard',
  baseColor: '#C9A227',
  roughness: 0.35,
  metalness: 0.85,
});

export function createLotusPavilion(
  options: { lampIntensity?: number } = {},
): Group {
  const pavilion = new Group();

  const plinth = createScenePrimitiveObject(
    {
      geometry: {
        type: 'cylinder',
        radiusTop: 2.9,
        radiusBottom: 3.05,
        height: 0.06,
        segments: 8,
      },
    },
    stoneMaterial,
  );
  plinth.position.y = 0.03;
  pavilion.add(plinth);

  const platform = createScenePrimitiveObject(
    {
      geometry: {
        type: 'cylinder',
        radiusTop: 2.3,
        radiusBottom: 2.45,
        height: 0.14,
        segments: 8,
      },
    },
    stoneMaterial,
  );
  platform.position.y = 0.13;
  pavilion.add(platform);

  const floorY = 0.2;
  const columnHeight = 2.1;
  for (let i = 0; i < 6; i++) {
    const angle = (i / 6) * Math.PI * 2;
    const column = createScenePrimitiveObject(
      {
        geometry: { type: 'cylinder', radius: 0.05, height: columnHeight, segments: 8 },
      },
      columnMaterial,
    );
    column.position.set(
      Math.cos(angle) * 1.85,
      floorY + columnHeight / 2,
      Math.sin(angle) * 1.85,
    );
    pavilion.add(column);
  }

  const roofBaseY = floorY + columnHeight;
  const roof = createScenePrimitiveObject(
    { geometry: { type: 'cone', radius: 2.75, height: 1.15, segments: 8 } },
    roofMaterial,
  );
  roof.position.y = roofBaseY + 0.575;
  pavilion.add(roof);

  const trim = createScenePrimitiveObject(
    {
      geometry: { type: 'torus', radius: 2.42, tube: 0.04, radialSegments: 8, tubularSegments: 32 },
    },
    goldMaterial,
  );
  trim.rotation.x = Math.PI / 2;
  trim.position.y = roofBaseY + 0.06;
  pavilion.add(trim);

  const finial = createScenePrimitiveObject(
    { geometry: { type: 'sphere', radius: 0.09, segments: 12 } },
    goldMaterial,
  );
  finial.position.y = roofBaseY + 1.15 + 0.05;
  pavilion.add(finial);

  const lamp = createGoddessLamp({
    bulbEmissiveIntensity: options.lampIntensity ?? 3,
  });
  lamp.position.y = floorY;
  pavilion.add(lamp);

  return pavilion;
}

const pondRimMaterial = createSceneMaterial({
  id: 'lotus-pond-rim',
  model: 'standard',
  baseColor: '#6E6A5E',
  roughness: 0.95,
});

const waterMaterial = createSceneMaterial({
  id: 'lotus-pond-water',
  model: 'standard',
  baseColor: '#5E93A8',
  roughness: 0.12,
  metalness: 0.05,
  opacity: 0.85,
  side: 'double',
});

const petalMaterial = createSceneMaterial({
  id: 'lotus-petal',
  model: 'standard',
  baseColor: '#E8A0B4',
  roughness: 0.7,
});

const lotusHeartMaterial = createSceneMaterial({
  id: 'lotus-heart',
  model: 'standard',
  baseColor: '#FFD98A',
  emissive: '#FFC44D',
  emissiveIntensity: 2,
  roughness: 0.5,
});

const leafMaterial = createSceneMaterial({
  id: 'lotus-leaf',
  model: 'standard',
  baseColor: '#3E6B34',
  roughness: 0.9,
});

/** 薄雾材质：两层透明度不同，须各用一个材质实例（模块级各建一份）。 */
const mistMaterialNear = createSceneMaterial({
  id: 'lotus-pond-mist-near',
  model: 'basic',
  baseColor: '#FFE9C4',
  opacity: 0.05,
  side: 'double',
});

const mistMaterialFar = createSceneMaterial({
  id: 'lotus-pond-mist-far',
  model: 'basic',
  baseColor: '#FFE9C4',
  opacity: 0.035,
  side: 'double',
});

/** 一朵莲花：五片外张的锥瓣 + 发光花心，旁附一片莲叶。原点在水面落点。 */
function createLotus(scale: number, yawDeg: number): Group {
  const flower = new Group();
  for (let i = 0; i < 5; i++) {
    const holder = new Group();
    holder.rotation.y = (i / 5) * Math.PI * 2;
    const petal = createScenePrimitiveObject(
      { geometry: { type: 'cone', radius: 0.055, height: 0.15, segments: 6 } },
      petalMaterial,
    );
    petal.position.set(0.05, 0.05, 0);
    petal.rotation.z = -0.62;
    holder.add(petal);
    flower.add(holder);
  }
  const heart = createScenePrimitiveObject(
    { geometry: { type: 'sphere', radius: 0.03, segments: 12 } },
    lotusHeartMaterial,
  );
  heart.position.y = 0.055;
  flower.add(heart);

  const leaf = createScenePrimitiveObject(
    { geometry: { type: 'cylinder', radius: 0.15, height: 0.012, segments: 12 } },
    leafMaterial,
  );
  leaf.position.set(0.24, -0.02, 0.1);
  flower.add(leaf);

  flower.scale.setScalar(scale);
  flower.rotation.y = (yawDeg * Math.PI) / 180;
  return flower;
}

/** 莲花分布写死：[距池心半径 m, 方位角°, 缩放]。 */
const LOTUS_PLACEMENTS: ReadonlyArray<readonly [number, number, number]> = [
  [0.9, 20, 1.0],
  [1.5, 95, 1.15],
  [1.1, 160, 0.85],
  [1.9, 215, 1.1],
  [0.7, 268, 0.9],
  [1.6, 322, 1.0],
];

export function createLotusPond(): Group {
  const pond = new Group();

  const rim = createScenePrimitiveObject(
    {
      geometry: { type: 'torus', radius: 3.02, tube: 0.055, radialSegments: 8, tubularSegments: 40 },
    },
    pondRimMaterial,
  );
  rim.rotation.x = Math.PI / 2;
  rim.position.y = 0.03;
  pond.add(rim);

  // 涟漪水面：Lathe 剖面沿半径作正弦起伏，顶点波纹 + 真实法线，零贴图零动画。
  const profile: Array<[number, number]> = [];
  const profileSteps = 9;
  for (let i = 0; i <= profileSteps; i++) {
    const r = (i / profileSteps) * 3.0;
    const ripple = 0.012 * Math.sin(r * 6.0) * (0.4 + 0.6 * (r / 3.0));
    profile.push([r, 0.02 + ripple]);
  }
  const water = createScenePrimitiveObject(
    { geometry: { type: 'lathe', profile, segments: 36 } },
    waterMaterial,
  );
  pond.add(water);

  for (const [radius, angleDeg, scale] of LOTUS_PLACEMENTS) {
    const angle = (angleDeg * Math.PI) / 180;
    const lotus = createLotus(scale, angleDeg * 2);
    lotus.position.set(Math.cos(angle) * radius, 0.045, Math.sin(angle) * radius);
    pond.add(lotus);
  }

  // 池面薄雾两层：极低透明度的暖白薄盘，近似晨雾（场景格式无 Fog 组件）。
  const mistLayers = [
    { radius: 3.3, y: 0.3, material: mistMaterialNear },
    { radius: 4.1, y: 0.62, material: mistMaterialFar },
  ] as const;
  for (const layer of mistLayers) {
    const mist = createScenePrimitiveObject(
      { geometry: { type: 'cylinder', radius: layer.radius, height: 0.01, segments: 24 } },
      layer.material,
    );
    mist.position.y = layer.y;
    pond.add(mist);
  }

  return pond;
}
