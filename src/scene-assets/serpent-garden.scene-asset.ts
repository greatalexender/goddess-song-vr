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
 * 蛇的自由花园（空间 3 · 交融），全部程序化低模生成。
 *
 * 一片野趣花地：浅绿圆坪 + 金角螺旋点阵的低模小花（郁金香式锥头，
 * 42 朵上限、避开踏石）、四块踏石小径、一棵大智慧树（粗干 + 宽冠，
 * 明显大于长椅旁的小树），树根旁盘着「蛇」的象征意象。
 *
 * 蛇不做写实：一段球链沿螺旋盘成圈，颈部三球微抬，头部一颗稍大的
 * 卵形球 + 两点发光小眼睛——取可爱、灵动的神，无獠牙、无鳞片、
 * 无舌。灯派生自 goddess-lamp 立在树另一侧，静态点亮；场景节点
 * 上的 PointLight 偏金（见 main 场景 JSON 中
 * serpent-garden-lamp-light，其位置 [1.55, 1.56, -0.85] 与本资产
 * 内灯落点 [1.55, 0, -0.85]、灯球高 1.56 对齐）。
 *
 * 全部位置由写死常量或确定性公式（金角螺旋）给出，禁用随机数。
 */

const patchMaterial = createSceneMaterial({
  id: 'serpent-garden-patch',
  model: 'standard',
  baseColor: '#557C3C',
  roughness: 1,
});

const stemMaterial = createSceneMaterial({
  id: 'serpent-garden-stem',
  model: 'standard',
  baseColor: '#3E6B34',
  roughness: 0.9,
});

const stoneMaterial = createSceneMaterial({
  id: 'serpent-garden-stone',
  model: 'standard',
  baseColor: '#7E786C',
  roughness: 0.95,
});

const trunkMaterial = createSceneMaterial({
  id: 'serpent-garden-trunk',
  model: 'standard',
  baseColor: '#54402C',
  roughness: 0.9,
});

const canopyMaterial = createSceneMaterial({
  id: 'serpent-garden-canopy',
  model: 'standard',
  baseColor: '#446E33',
  roughness: 0.95,
});

const canopyLightMaterial = createSceneMaterial({
  id: 'serpent-garden-canopy-light',
  model: 'standard',
  baseColor: '#527D3C',
  roughness: 0.95,
});

const snakeBodyMaterial = createSceneMaterial({
  id: 'serpent-garden-snake-body',
  model: 'standard',
  baseColor: '#5FAE4E',
  roughness: 0.45,
});

const snakeEyeMaterial = createSceneMaterial({
  id: 'serpent-garden-snake-eye',
  model: 'standard',
  baseColor: '#FFF6C8',
  emissive: '#FFE9A8',
  emissiveIntensity: 3,
  roughness: 0.4,
});

/** 花色五种，各建一个材质实例（发光同色、低强度，让花点在晨光里跳）。 */
const FLOWER_COLORS: ReadonlyArray<`#${string}`> = [
  '#E86A7A',
  '#F2B544',
  '#B48AE0',
  '#EF8354',
  '#F5F0E6',
];

const flowerMaterials = FLOWER_COLORS.map((color, i) =>
  createSceneMaterial({
    id: `serpent-garden-flower-${i}`,
    model: 'standard',
    baseColor: color,
    emissive: color,
    emissiveIntensity: 0.35,
    roughness: 0.6,
  }),
);

/** 踏石小径写死：[x, z, 半径]，自坪边向智慧树方向收进。 */
const STEPPING_STONES: ReadonlyArray<readonly [number, number, number]> = [
  [0.55, 2.35, 0.34],
  [0.15, 1.85, 0.3],
  [0.5, 1.35, 0.36],
  [0.1, 0.85, 0.3],
];

const FLOWER_COUNT = 42;
const FLOWER_FIELD_RADIUS = 2.25;

/** 一朵小花：细茎 + 锥形花头。原点在坪面落点。 */
function createFlower(materialIndex: number): Group {
  const flower = new Group();
  const stem = createScenePrimitiveObject(
    { geometry: { type: 'cylinder', radius: 0.012, height: 0.16, segments: 5 } },
    stemMaterial,
  );
  stem.position.y = 0.08;
  flower.add(stem);
  const head = createScenePrimitiveObject(
    { geometry: { type: 'cone', radius: 0.05, height: 0.09, segments: 6 } },
    flowerMaterials[materialIndex % flowerMaterials.length],
  );
  head.position.y = 0.2;
  flower.add(head);
  return flower;
}

/**
 * 蛇的象征意象：球链螺旋盘圈 + 微抬的颈与头 + 发光眼点。
 * 原点在盘心地面，头部朝本地 +X 抬起。
 */
function createSerpentFigure(): Group {
  const serpent = new Group();

  // 盘身：十颗球沿收分螺旋，每颗略高于前一颗，成盘起的圈。
  const coilSteps = 10;
  for (let i = 0; i < coilSteps; i++) {
    const t = i / (coilSteps - 1);
    const angle = t * Math.PI * 1.85;
    const radius = 0.34 - 0.13 * t;
    const bead = createScenePrimitiveObject(
      { geometry: { type: 'sphere', radius: 0.088, segments: 10 } },
      snakeBodyMaterial,
    );
    bead.position.set(
      Math.cos(angle) * radius,
      0.085 + t * 0.05,
      Math.sin(angle) * radius,
    );
    serpent.add(bead);
  }

  // 颈：三颗球向 +X 渐抬。
  const neckBeads: ReadonlyArray<readonly [number, number, number, number]> = [
    [0.3, 0.16, 0.05, 0.082],
    [0.36, 0.26, 0.06, 0.078],
    [0.4, 0.35, 0.07, 0.075],
  ];
  for (const [x, y, z, r] of neckBeads) {
    const bead = createScenePrimitiveObject(
      { geometry: { type: 'sphere', radius: r, segments: 10 } },
      snakeBodyMaterial,
    );
    bead.position.set(x, y, z);
    serpent.add(bead);
  }

  // 头：稍大的卵形球，朝 +X 微伸。
  const head = createScenePrimitiveObject(
    { geometry: { type: 'sphere', radius: 0.1, segments: 12 } },
    snakeBodyMaterial,
  );
  head.position.set(0.44, 0.44, 0.07);
  head.scale.set(1.1, 0.92, 1.05);
  serpent.add(head);

  // 眼睛：两点暖光小球，在头的前上两侧。
  for (const z of [0.135, 0.005]) {
    const eye = createScenePrimitiveObject(
      { geometry: { type: 'sphere', radius: 0.02, segments: 8 } },
      snakeEyeMaterial,
    );
    eye.position.set(0.51, 0.49, z);
    serpent.add(eye);
  }

  return serpent;
}

/** 智慧树：粗干 + 一枝斜枝 + 四团宽冠。明显大于长椅旁的小树。 */
function createWisdomTree(): Group {
  const tree = new Group();

  const trunk = createScenePrimitiveObject(
    {
      geometry: {
        type: 'cylinder',
        radiusTop: 0.16,
        radiusBottom: 0.26,
        height: 2.4,
        segments: 10,
      },
    },
    trunkMaterial,
  );
  trunk.position.y = 1.2;
  tree.add(trunk);

  const branch = createScenePrimitiveObject(
    { geometry: { type: 'cylinder', radius: 0.06, height: 1.1, segments: 8 } },
    trunkMaterial,
  );
  branch.position.set(0.42, 2.55, 0.1);
  branch.rotation.z = -0.7;
  tree.add(branch);

  const canopyLayers: ReadonlyArray<{
    radius: number;
    position: readonly [number, number, number];
    squash: number;
    material: typeof canopyMaterial;
  }> = [
    { radius: 1.2, position: [0, 3.35, 0], squash: 0.62, material: canopyMaterial },
    { radius: 0.95, position: [0.85, 2.95, 0.3], squash: 0.68, material: canopyLightMaterial },
    { radius: 0.9, position: [-0.8, 3.0, -0.35], squash: 0.68, material: canopyMaterial },
    { radius: 0.7, position: [0.1, 3.7, -0.5], squash: 0.7, material: canopyLightMaterial },
  ];
  for (const layer of canopyLayers) {
    const blob = createScenePrimitiveObject(
      { geometry: { type: 'sphere', radius: layer.radius, segments: 14 } },
      layer.material,
    );
    blob.position.set(...layer.position);
    blob.scale.set(1, layer.squash, 1);
    tree.add(blob);
  }

  return tree;
}

export function createSerpentGarden(
  options: { lampIntensity?: number } = {},
): Group {
  const garden = new Group();

  // 浅绿圆坪：比园地略亮的一小片地，顶面 y=0.04。
  const patch = createScenePrimitiveObject(
    { geometry: { type: 'cylinder', radius: 2.6, height: 0.04, segments: 28 } },
    patchMaterial,
  );
  patch.position.y = 0.02;
  garden.add(patch);

  // 花点阵：金角螺旋（确定性公式），避开踏石 0.34 m 内。
  const goldenAngle = 2.399963;
  for (let i = 0; i < FLOWER_COUNT; i++) {
    const angle = i * goldenAngle;
    const radius = FLOWER_FIELD_RADIUS * Math.sqrt((i + 0.5) / FLOWER_COUNT);
    const x = Math.cos(angle) * radius;
    const z = Math.sin(angle) * radius;
    const onPath = STEPPING_STONES.some(
      ([sx, sz]) => Math.hypot(x - sx, z - sz) < 0.34,
    );
    if (onPath) continue;
    const flower = createFlower(i);
    flower.position.set(x, 0.04, z);
    garden.add(flower);
  }

  // 踏石小径。
  for (const [x, z, radius] of STEPPING_STONES) {
    const stone = createScenePrimitiveObject(
      { geometry: { type: 'cylinder', radius, height: 0.05, segments: 10 } },
      stoneMaterial,
    );
    stone.position.set(x, 0.055, z);
    garden.add(stone);
  }

  // 智慧树立在坪的后左，蛇盘在树根旁。
  const tree = createWisdomTree();
  tree.position.set(-1.0, 0.04, -1.0);
  garden.add(tree);

  const serpent = createSerpentFigure();
  serpent.position.set(-0.45, 0.04, -0.3);
  garden.add(serpent);

  // 树另一侧的灯：派生 goddess-lamp，静态点亮，灯光偏金在场景节点上给。
  const lamp = createGoddessLamp({
    bulbEmissiveIntensity: options.lampIntensity ?? 3,
  });
  lamp.position.set(1.55, 0, -0.85);
  garden.add(lamp);

  return garden;
}
