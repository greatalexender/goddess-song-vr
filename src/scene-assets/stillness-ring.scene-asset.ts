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

/**
 * 归于宁静（空间 5）的唯一资产：一圈浅色石环。
 *
 * 花园中心偏入口一侧的一处极简空地——只有九块浅色扁石围成的环，
 * 环心是空的。这一段的设计就是留白：无面板、无文字、无灯、无摆设
 * （空间的登记与 0 号主灯的归静意图见 src/spaces/spaces.ts 空间 5
 * 条目）。石环不新增任何光源，环心的「主角」是空无本身。
 *
 * 石块尺寸由写死常量表给出（确定性微差，像人手摆的），禁用随机数。
 * 原点在环心地面。
 */

const ringStoneMaterial = createSceneMaterial({
  id: 'stillness-ring-stone',
  model: 'standard',
  baseColor: '#A39C8D',
  roughness: 0.95,
});

/** 九块石：[角度°, 半径微差, 石块半径]——手摆感的确定性参差。 */
const RING_STONES: ReadonlyArray<readonly [number, number, number]> = [
  [0, 1.15, 0.2],
  [40, 1.1, 0.17],
  [81, 1.18, 0.22],
  [119, 1.12, 0.18],
  [160, 1.16, 0.21],
  [201, 1.11, 0.17],
  [240, 1.17, 0.2],
  [282, 1.13, 0.19],
  [321, 1.15, 0.21],
];

export function createStillnessRing(): Group {
  const ring = new Group();
  for (const [angleDeg, distance, radius] of RING_STONES) {
    const angle = (angleDeg * Math.PI) / 180;
    const stone = createScenePrimitiveObject(
      { geometry: { type: 'cylinder', radius, height: 0.055, segments: 9 } },
      ringStoneMaterial,
    );
    stone.position.set(
      Math.cos(angle) * distance,
      0.028,
      Math.sin(angle) * distance,
    );
    ring.add(stone);
  }
  return ring;
}
