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
  MeshBasicMaterial,
  Vector3,
} from '@iwsdk/core';
import type { Object3D } from '@iwsdk/core';

/**
 * 冥想地（空间 7 · Sri Vidya），全部程序化低模生成。
 *
 * 构成：临莲池的一方石台 + 一只坐垫，坐前空中悬置一幅以金色线条
 * 绘出的 Sri Chakra（九个交叠三角形 + 双圆 + 方框 bhupura + 中心
 * bindu）。**光轮无任何支撑、不落地、不触水**——它悬在坐席前方约
 * 1.55 m、离地约 1.3 m 处，正对坐者的视线。
 *
 * 设计纪律（Solomon 定，写死在此，后续阶段不得违背）：
 * - 女神在此**不立像**：只以光（Sri Chakra 的金线）与莲（眼前真实
 *   的莲池、台边一朵小莲）为引，观想在坐者心中发生；
 * - 本空间**无面板、无文字**（与归静环同纪律）：坐与观想不需要读字；
 * - 呈现口径是**体验与致敬，不自称传法、不自称正宗**——这是一件
 *   向传统致敬的光绘装置，不是坛城法物；
 * - **零新增光源**：金线全部用 MeshBasicMaterial（无光照模型，颜色
 *   即所见），不添任何 PointLight（全场点光源守恒 4 盏已满）。
 *
 * 几何实现：线条不用 Line（1px 线宽在头显里几乎不可见），而是把
 * 每条边做成一根细圆柱「光束」（半径 7.5 mm、5 边），两点间以
 * 四元数对齐；九个三角形按大小分四层组（chakra-tier-0…3），外加
 * 外框组（chakra-frame：双圆 + 方框）与 bindu 组（chakra-bindu：
 * 光点 + 光晕）。分层是为了收束动画：MeditationSystem 按层把线条
 * 向中心 bindu 收拢（见 src/spaces/meditation-system.ts）。
 * 每层一个独立材质实例，系统逐层调 opacity / scale，互不串扰。
 *
 * 本地朝向：坐席在原点、坐者面向 -Z；光轮在 -Z 前方。场景编排
 * （临池位置/朝池转角）在 public/scenes/main.iwsdk.scene.json。
 */

const stoneMaterial = createSceneMaterial({
  id: 'meditation-seat-stone',
  model: 'standard',
  baseColor: '#A39C8D',
  roughness: 0.95,
});

const cushionMaterial = createSceneMaterial({
  id: 'meditation-seat-cushion',
  model: 'standard',
  baseColor: '#7A3B2E',
  roughness: 0.9,
});

const petalMaterial = createSceneMaterial({
  id: 'meditation-lotus-petal',
  model: 'standard',
  baseColor: '#E8A0B4',
  roughness: 0.7,
});

const lotusHeartMaterial = createSceneMaterial({
  id: 'meditation-lotus-heart',
  model: 'standard',
  baseColor: '#FFD98A',
  emissive: '#FFC44D',
  emissiveIntensity: 2,
  roughness: 0.5,
});

/** 光束半径：7.5 mm——头显里读得出是「线」，又不抢戏。 */
const BEAM_RADIUS = 0.0075;
const UNIT_UP = new Vector3(0, 1, 0);

/** 在两个 2D 点之间拉一根光束（z 恒为光轮平面），返回已定位的网格。 */
function beamBetween(
  ax: number,
  ay: number,
  bx: number,
  by: number,
  material: MeshBasicMaterial,
): Object3D {
  const from = new Vector3(ax, ay, 0);
  const to = new Vector3(bx, by, 0);
  const direction = new Vector3().subVectors(to, from);
  const length = direction.length();
  const beam = createScenePrimitiveObject(
    { geometry: { type: 'cylinder', radius: 1, height: 1, segments: 5 } },
    material,
  );
  beam.position.copy(from).add(to).multiplyScalar(0.5);
  beam.quaternion.setFromUnitVectors(UNIT_UP, direction.normalize());
  beam.scale.set(BEAM_RADIUS, length, BEAM_RADIUS);
  return beam;
}

/** 一个三角形：[半宽 a, 高 h, 中心 y 偏移 cy, 是否尖朝上]。 */
type TriangleSpec = readonly [number, number, number, boolean];

function buildTriangle(
  spec: TriangleSpec,
  material: MeshBasicMaterial,
): Group {
  const [a, h, cy, up] = spec;
  const apexY = cy + (up ? h / 2 : -h / 2);
  const baseY = cy + (up ? -h / 2 : h / 2);
  const triangle = new Group();
  triangle.add(beamBetween(0, apexY, -a, baseY, material));
  triangle.add(beamBetween(0, apexY, a, baseY, material));
  triangle.add(beamBetween(-a, baseY, a, baseY, material));
  return triangle;
}

/**
 * 九个交叠三角形（四上五下），按「由外向内」的大小序分四层：
 * tier-0 最大的一对（一上一下），tier-3 最小的一对再加最内的小下
 * 三角（它环抱 bindu，收束时最后消失）。尺寸/偏移全部写死
 * （资产双 realm 求值须确定性），比例是视觉近似，非仪式量度。
 */
const CHAKRA_TIERS: ReadonlyArray<readonly TriangleSpec[]> = [
  [
    [0.6, 0.78, 0.0, true],
    [0.55, 0.72, 0.01, false],
  ],
  [
    [0.47, 0.62, -0.04, true],
    [0.43, 0.56, -0.03, false],
  ],
  [
    [0.34, 0.45, 0.03, true],
    [0.3, 0.4, 0.04, false],
  ],
  [
    [0.21, 0.28, -0.01, true],
    [0.185, 0.25, 0.0, false],
    [0.095, 0.13, 0.01, false],
  ],
];

function goldLineMaterial(): MeshBasicMaterial {
  return new MeshBasicMaterial({
    color: '#FFD98A',
    transparent: true,
    opacity: 1,
  });
}

/** Sri Chakra 光轮：外框 + 四层三角 + bindu，原点在轮心。 */
function createSriChakra(): Group {
  const chakra = new Group();
  chakra.name = 'sri-chakra';

  // 外框：双圆 + 方框（bhupura 的简化轮廓），收束时最先隐去。
  const frame = new Group();
  frame.name = 'chakra-frame';
  const frameMaterial = goldLineMaterial();
  for (const radius of [0.7, 0.655]) {
    const circle = createScenePrimitiveObject(
      {
        geometry: {
          type: 'torus',
          radius,
          tube: BEAM_RADIUS,
          radialSegments: 6,
          tubularSegments: 64,
        },
      },
      frameMaterial,
    );
    frame.add(circle);
  }
  const half = 0.8;
  frame.add(beamBetween(-half, -half, half, -half, frameMaterial));
  frame.add(beamBetween(half, -half, half, half, frameMaterial));
  frame.add(beamBetween(half, half, -half, half, frameMaterial));
  frame.add(beamBetween(-half, half, -half, -half, frameMaterial));
  chakra.add(frame);

  CHAKRA_TIERS.forEach((tierSpecs, tierIndex) => {
    const tier = new Group();
    tier.name = `chakra-tier-${tierIndex}`;
    const material = goldLineMaterial();
    for (const spec of tierSpecs) {
      tier.add(buildTriangle(spec, material));
    }
    chakra.add(tier);
  });

  // bindu：轮心的一点光 + 一层薄光晕。收束的终点，也是唯一的留守者。
  const bindu = new Group();
  bindu.name = 'chakra-bindu';
  const binduCore = createScenePrimitiveObject(
    { geometry: { type: 'sphere', radius: 0.02, segments: 12 } },
    new MeshBasicMaterial({ color: '#FFEFC0', transparent: true }),
  );
  bindu.add(binduCore);
  const binduHalo = createScenePrimitiveObject(
    { geometry: { type: 'sphere', radius: 0.055, segments: 12 } },
    new MeshBasicMaterial({
      color: '#FFD98A',
      transparent: true,
      opacity: 0.16,
      depthWrite: false,
    }),
  );
  bindu.add(binduHalo);
  chakra.add(bindu);

  return chakra;
}

/** 台边一朵小莲：五片锥瓣 + 发光花心（与莲池同语汇的近引）。 */
function createSeatLotus(): Group {
  const flower = new Group();
  for (let i = 0; i < 5; i++) {
    const holder = new Group();
    holder.rotation.y = (i / 5) * Math.PI * 2;
    const petal = createScenePrimitiveObject(
      { geometry: { type: 'cone', radius: 0.05, height: 0.14, segments: 6 } },
      petalMaterial,
    );
    petal.position.set(0.045, 0.045, 0);
    petal.rotation.z = -0.62;
    holder.add(petal);
    flower.add(holder);
  }
  const heart = createScenePrimitiveObject(
    { geometry: { type: 'sphere', radius: 0.028, segments: 12 } },
    lotusHeartMaterial,
  );
  heart.position.y = 0.05;
  flower.add(heart);
  return flower;
}

export function createMeditationSeat(): Group {
  const seat = new Group();

  const platform = createScenePrimitiveObject(
    {
      geometry: { type: 'cylinder', radius: 1.05, height: 0.08, segments: 18 },
    },
    stoneMaterial,
  );
  platform.position.y = 0.04;
  seat.add(platform);

  const cushion = createScenePrimitiveObject(
    {
      geometry: { type: 'cylinder', radius: 0.55, height: 0.13, segments: 18 },
    },
    cushionMaterial,
  );
  cushion.position.y = 0.145;
  seat.add(cushion);

  const lotus = createSeatLotus();
  lotus.position.set(0.62, 0.08, -0.55);
  seat.add(lotus);

  // 光轮悬置：坐前 1.55 m、轮心离地 1.3 m，无支撑、不落地。
  const chakra = createSriChakra();
  chakra.position.set(0, 1.3, -1.55);
  seat.add(chakra);

  return seat;
}
