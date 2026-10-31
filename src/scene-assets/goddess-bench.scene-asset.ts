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
 * 真曦的长椅（空间 2 · 回应），全部程序化低模生成。
 *
 * 一张木板条长椅（椅面三条板、靠背两条板、石腿），椅旁一棵小树
 * （细干 + 三层球冠面片），椅边一盏派生自 goddess-lamp 的灯。
 * 本段弧是「静」：灯比莲花亭主灯更暖、更弱、光圈更小——bulb
 * emissive 2.2（亭灯 3），场景节点上的 PointLight 也相应调低
 * （暖橙、intensity 3.5、distance 5，见 main 场景 JSON 中
 * goddess-bench-lamp-light 节点，其位置 [1.4, 1.56, 0.4] 与本
 * 资产内灯的落点 [1.4, 0, 0.4]、灯球高 1.56 对齐）。
 *
 * 原点在长椅中心地面，坐者面朝本地 +Z；场景里整组转向花园中心，
 * 坐下正望见园心与 0 号灯的方向。位置全部写死，保资产确定性。
 */

const benchWoodMaterial = createSceneMaterial({
  id: 'goddess-bench-wood',
  model: 'standard',
  baseColor: '#7A5230',
  roughness: 0.8,
});

const benchStoneMaterial = createSceneMaterial({
  id: 'goddess-bench-stone',
  model: 'standard',
  baseColor: '#6E6A5E',
  roughness: 0.95,
});

const trunkMaterial = createSceneMaterial({
  id: 'goddess-bench-trunk',
  model: 'standard',
  baseColor: '#5A4632',
  roughness: 0.9,
});

const canopyMaterial = createSceneMaterial({
  id: 'goddess-bench-canopy',
  model: 'standard',
  baseColor: '#4E7A3A',
  roughness: 0.95,
});

const canopyLightMaterial = createSceneMaterial({
  id: 'goddess-bench-canopy-light',
  model: 'standard',
  baseColor: '#5F8F45',
  roughness: 0.95,
});

export function createGoddessBench(
  options: { lampIntensity?: number } = {},
): Group {
  const bench = new Group();

  // 椅面：三条板，沿 X 展开，坐者面朝 +Z（靠背在 -Z 侧）。
  for (const z of [-0.15, 0, 0.15]) {
    const slat = createScenePrimitiveObject(
      { geometry: { type: 'box', size: [1.9, 0.05, 0.13] } },
      benchWoodMaterial,
    );
    slat.position.set(0, 0.46, z);
    bench.add(slat);
  }

  // 靠背：两条板，微微后仰。
  for (const y of [0.82, 1.02]) {
    const backSlat = createScenePrimitiveObject(
      { geometry: { type: 'box', size: [1.9, 0.13, 0.04] } },
      benchWoodMaterial,
    );
    backSlat.position.set(0, y, -0.27 - (y - 0.82) * 0.1);
    backSlat.rotation.x = -0.1;
    bench.add(backSlat);
  }
  for (const x of [-0.86, 0.86]) {
    const post = createScenePrimitiveObject(
      { geometry: { type: 'box', size: [0.07, 0.66, 0.05] } },
      benchWoodMaterial,
    );
    post.position.set(x, 0.76, -0.28);
    post.rotation.x = -0.1;
    bench.add(post);
  }

  // 石腿两块。
  for (const x of [-0.78, 0.78]) {
    const leg = createScenePrimitiveObject(
      { geometry: { type: 'box', size: [0.14, 0.46, 0.52] } },
      benchStoneMaterial,
    );
    leg.position.set(x, 0.23, 0);
    bench.add(leg);
  }

  // 扶手：横条 + 前端小支柱。
  for (const x of [-0.95, 0.95]) {
    const arm = createScenePrimitiveObject(
      { geometry: { type: 'box', size: [0.05, 0.04, 0.52] } },
      benchWoodMaterial,
    );
    arm.position.set(x, 0.68, 0);
    bench.add(arm);
    const armPost = createScenePrimitiveObject(
      { geometry: { type: 'box', size: [0.05, 0.2, 0.05] } },
      benchWoodMaterial,
    );
    armPost.position.set(x, 0.57, 0.2);
    bench.add(armPost);
  }

  // 椅旁小树：细干 + 两层球冠（压扁球体面片感），比智慧树小一号。
  const tree = new Group();
  const trunk = createScenePrimitiveObject(
    {
      geometry: {
        type: 'cylinder',
        radiusTop: 0.07,
        radiusBottom: 0.11,
        height: 1.5,
        segments: 8,
      },
    },
    trunkMaterial,
  );
  trunk.position.y = 0.75;
  tree.add(trunk);

  const canopyLayers: ReadonlyArray<{
    radius: number;
    position: readonly [number, number, number];
    squash: number;
    material: typeof canopyMaterial;
  }> = [
    { radius: 0.78, position: [0, 1.95, 0], squash: 0.72, material: canopyMaterial },
    { radius: 0.58, position: [0.42, 1.68, 0.18], squash: 0.75, material: canopyLightMaterial },
    { radius: 0.5, position: [-0.4, 1.74, -0.15], squash: 0.75, material: canopyLightMaterial },
  ];
  for (const layer of canopyLayers) {
    const blob = createScenePrimitiveObject(
      { geometry: { type: 'sphere', radius: layer.radius, segments: 12 } },
      layer.material,
    );
    blob.position.set(...layer.position);
    blob.scale.set(1, layer.squash, 1);
    tree.add(blob);
  }
  tree.position.set(-1.55, 0, -0.35);
  bench.add(tree);

  // 椅边灯：派生 goddess-lamp，静态点亮、亮度低于莲花亭主灯分主次。
  const lamp = createGoddessLamp({
    bulbEmissiveIntensity: options.lampIntensity ?? 2.2,
  });
  lamp.position.set(1.4, 0, 0.4);
  bench.add(lamp);

  return bench;
}
