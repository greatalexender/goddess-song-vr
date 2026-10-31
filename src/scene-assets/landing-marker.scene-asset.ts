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
 * 落点标记：贴地的低调光环，原点在环心地面，本地 +Z 无朝向意义。
 *
 * 两种尺寸：space（外径约 0.97 m，段落间移动的主标记）与 revisit
 * （外径约 0.37 m，归静处一排回访小点）。每次工厂调用都新建材质
 * 实例——场景里每个标记节点用独立登记的资产 id（见 src/assets.ts），
 * 段落系统才能逐个调 emissiveIntensity 做「待激活 / 已激活 / 注视中」
 * 的脉冲，不会相互串色。几何只用低段数 torus / cylinder / sphere。
 */
export interface LandingMarkerOptions {
  variant?: 'space' | 'revisit';
  /** 发光色（环与心的 emissive）。 */
  accent?: string;
  /** 静态基准 emissiveIntensity；系统运行时在此之上做倍率脉冲。 */
  baseEmissiveIntensity?: number;
}

export function createLandingMarker(
  options: LandingMarkerOptions = {},
): Group {
  const revisit = options.variant === 'revisit';
  const accent = options.accent ?? '#FFC46B';
  const base = options.baseEmissiveIntensity ?? 0.55;

  const ringMaterial = new MeshStandardMaterial({
    color: '#2C2118',
    emissive: accent,
    emissiveIntensity: base,
    roughness: 0.5,
  });
  const coreMaterial = new MeshStandardMaterial({
    color: '#2C2118',
    emissive: accent,
    emissiveIntensity: base * 1.25,
    roughness: 0.5,
  });

  const marker = new Group();
  marker.name = 'landing-marker';

  const outerRadius = revisit ? 0.17 : 0.46;
  const outer = createScenePrimitiveObject(
    {
      geometry: {
        type: 'torus',
        radius: outerRadius,
        tube: revisit ? 0.013 : 0.024,
        radialSegments: 6,
        tubularSegments: 36,
      },
    },
    ringMaterial,
  );
  outer.name = 'landing-marker-ring';
  outer.rotation.x = Math.PI / 2;
  outer.position.y = revisit ? 0.02 : 0.035;
  marker.add(outer);

  if (!revisit) {
    const inner = createScenePrimitiveObject(
      {
        geometry: {
          type: 'torus',
          radius: 0.29,
          tube: 0.011,
          radialSegments: 6,
          tubularSegments: 28,
        },
      },
      ringMaterial,
    );
    inner.name = 'landing-marker-ring-inner';
    inner.rotation.x = Math.PI / 2;
    inner.position.y = 0.03;
    marker.add(inner);

    // 四个方位小点：让环在草地上有「刻度」，注视时容易锚定环心。
    for (let i = 0; i < 4; i++) {
      const angle = (i / 4) * Math.PI * 2;
      const dot = createScenePrimitiveObject(
        { geometry: { type: 'sphere', radius: 0.02, segments: 8 } },
        coreMaterial,
      );
      dot.position.set(Math.cos(angle) * 0.375, 0.04, Math.sin(angle) * 0.375);
      marker.add(dot);
    }
  }

  const core = createScenePrimitiveObject(
    {
      geometry: {
        type: 'cylinder',
        radius: revisit ? 0.045 : 0.085,
        height: 0.018,
        segments: 16,
      },
    },
    coreMaterial,
  );
  core.name = 'landing-marker-core';
  core.position.y = 0.02;
  marker.add(core);

  return marker;
}
