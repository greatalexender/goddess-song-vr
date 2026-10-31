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
  MeshStandardMaterial,
} from '@iwsdk/core';

/**
 * 《女神之歌》最小场景资产：空花园地面 + 一盏发光的灯。
 *
 * 设计约束（Quest 3S 60fps 性能预算）：几何只用低段数基本体，材质全局共享，
 * 不在本文件里加载任何外部模型/贴图。后续五段弧的五个空间各自新建
 * *.scene-asset.ts 并在 src/assets.ts 注册，不要往本文件里堆。
 */

const grassMaterial = createSceneMaterial({
  id: 'garden-grass',
  model: 'standard',
  baseColor: '#4A6B35',
  roughness: 1,
});

/** 一块空花园地面：半径 18 m 的圆形草地，顶面与 y=0 齐平，原点在圆心。 */
export function createGardenGround(radius = 18): Group {
  const ground = createScenePrimitiveObject(
    {
      geometry: { type: 'cylinder', radius, height: 0.05, segments: 48 },
    },
    grassMaterial,
  );
  ground.position.y = -0.025;
  const root = new Group();
  root.add(ground);
  return root;
}

const poleMaterial = createSceneMaterial({
  id: 'goddess-lamp-pole',
  model: 'standard',
  baseColor: '#3A3128',
  roughness: 0.6,
  metalness: 0.4,
});

/**
 * 一盏灯：细杆 + 暖色发光球。球体靠 emissive 自发光呈现「亮」，
 * 真正照亮地面的光由场景节点上的 PointLight 组件提供（见 main 场景）。
 * 造型锚点是本作的题眼——「无明中的一盏灯」。
 *
 * `bulbEmissiveIntensity` 是给各空间派生灯预留的亮度参数：后续空间音频
 * 接入时，灯的明暗将随歌声呼吸（钩子见 src/spaces/spaces.ts 的
 * applySpaceLampAudioLevel），各空间在静态阶段先用本参数给出点亮态。
 */
export function createGoddessLamp(
  options: { bulbEmissiveIntensity?: number } = {},
): Group {
  const lamp = new Group();
  const pole = createScenePrimitiveObject(
    { geometry: { type: 'cylinder', radius: 0.03, height: 1.5, segments: 12 } },
    poleMaterial,
  );
  pole.position.y = 0.75;
  const bulbMaterial = new MeshStandardMaterial({
    color: '#FFF2D8',
    emissive: '#FFB84D',
    emissiveIntensity: options.bulbEmissiveIntensity ?? 3,
    roughness: 0.4,
  });
  const bulb = createScenePrimitiveObject(
    { geometry: { type: 'sphere', radius: 0.09, segments: 24 } },
    bulbMaterial,
  );
  bulb.position.y = 1.56;
  lamp.add(pole, bulb);
  return lamp;
}
