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
 * 花园之门：两根立柱 + 一道横梁的极简门意象，立在玩家出生点与 0 号灯之间，
 * 把「入园」做成一个看得见的门槛。横梁下沿嵌一条暖金色发光细带，
 * 是剪影门里的一线光——呼应全作「光」的题眼，不做任何复杂建模。
 *
 * 原点在两柱之间的地面中心，门面朝 ±Z；场景里以默认朝向放在小径上，
 * 玩家透过门框正望见 0 号灯。
 */

const gateWoodMaterial = createSceneMaterial({
  id: 'garden-gate-wood',
  model: 'standard',
  baseColor: '#4A3626',
  roughness: 0.85,
  metalness: 0.05,
});

const gateTrimMaterial = createSceneMaterial({
  id: 'garden-gate-trim',
  model: 'standard',
  baseColor: '#7A5A20',
  emissive: '#FFB84D',
  emissiveIntensity: 1.6,
  roughness: 0.4,
  metalness: 0.3,
});

export function createGardenGate(): Group {
  const gate = new Group();

  for (const x of [-1.05, 1.05]) {
    const post = createScenePrimitiveObject(
      { geometry: { type: 'cylinder', radius: 0.07, height: 2.6, segments: 10 } },
      gateWoodMaterial,
    );
    post.position.set(x, 1.3, 0);
    gate.add(post);
  }

  const lintel = createScenePrimitiveObject(
    { geometry: { type: 'box', size: [2.6, 0.14, 0.18] } },
    gateWoodMaterial,
  );
  lintel.position.y = 2.62;
  gate.add(lintel);

  const trim = createScenePrimitiveObject(
    { geometry: { type: 'box', size: [2.6, 0.03, 0.19] } },
    gateTrimMaterial,
  );
  trim.position.y = 2.53;
  gate.add(trim);

  return gate;
}
