/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import {
  createScenePrimitiveObject,
  Group,
  MeshStandardMaterial,
} from '@iwsdk/core';

/**
 * 长椅留言标记：悬在椅面之下的一点微光，原点在光点中心。
 *
 * 这是数字城「城门口留言版」在园子里的落点——人看见的只是一点
 * 若有若无的暖光，注视它（或对它捏合）才展开椅下的留言面板。只
 * 在自由回访模式下显形（显隐由 BenchNotesSystem 控制），五段弧
 * 进行中不存在，不打扰段落体验。
 *
 * 每次工厂调用都新建材质实例：BenchNotesSystem 要单独给它做呼
 * 吸脉冲，不能与落点标记串色。几何只有一个低段数小球（约百余
 * 三角面），零点光源——它只是 emissive，不照亮任何东西。
 */
export function createBenchNoteMarker(): Group {
  const glowMaterial = new MeshStandardMaterial({
    color: '#2C2118',
    emissive: '#FFB37A',
    emissiveIntensity: 0.85,
    roughness: 0.5,
  });

  const marker = new Group();
  marker.name = 'bench-note-marker';

  const glow = createScenePrimitiveObject(
    { geometry: { type: 'sphere', radius: 0.03, segments: 10 } },
    glowMaterial,
  );
  glow.name = 'bench-note-marker-glow';
  marker.add(glow);

  return marker;
}
