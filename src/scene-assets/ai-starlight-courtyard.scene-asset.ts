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
 * AI 星光庭院（空间 4 · 内在之光），全部程序化低模生成。
 *
 * 花园北侧一片开阔草坪，中央悬浮着 AI 居民「微光」：一颗淡青色
 * 半透明光球（外壳 opacity 0.45），内里是一团几何光纹——发光小核 +
 * 三个不同倾角的细环（torus），全部靠 emissive 自发光造「光在球里」
 * 的感觉。球下地面有一圈星光装置：两圈同心 emissive 小点阵。
 * 四周散布低矮花草（金角螺旋点阵，与蛇园同法、密度更低）。
 *
 * 光源纪律：本空间**不新增 PointLight**（全场 4 盏点光源逐盏评审制，
 * 本阶段守恒）。微光的「光」是 emissive 的视觉光，不是照明光——
 * 它不照亮地面，这是刻意的：内在之光照的是自己。段落音频接入后，
 * applySpaceLampAudioLevel 的钩子将驱动外壳与内纹的 emissiveIntensity
 * （静态点亮值由本工场的 orbEmissiveIntensity 参数给出）。
 *
 * 旋转：内纹三环在本阶段是静态倾角构图；「缓慢旋转」需要段落系统
 * 逐帧驱动子组——随空间系统一并接入（见文末 ORB_CORE_GROUP_NAME，
 * 系统按名取组旋转），本阶段不冒充已有动画。
 *
 * 位置全部写死或确定性公式（金角螺旋），禁用随机数。原点在草坪
 * 圆心地面，微光悬浮于原点上方 1.5 m；场景里整组置于花园北侧，
 * 朝向花园中心（见 main 场景 JSON）。
 */

/** 微光内纹子组的名字：将来段落系统按名取它做缓慢旋转。 */
export const ORB_CORE_GROUP_NAME = 'starlight-orb-core';

const lawnMaterial = createSceneMaterial({
  id: 'starlight-courtyard-lawn',
  model: 'standard',
  baseColor: '#5D8148',
  roughness: 1,
});

/** 微光内纹：发光核。高 emissive、近白青，球里最亮的一点。 */
const orbCoreMaterial = new MeshStandardMaterial({
  color: '#EAFBF6',
  emissive: '#BFF5E9',
  emissiveIntensity: 3.2,
  roughness: 0.3,
});

/** 微光内纹：三环共用一个材质实例，青色发光细线感。 */
const orbRingMaterial = new MeshStandardMaterial({
  color: '#CFF7EE',
  emissive: '#7FE3D4',
  emissiveIntensity: 2.2,
  roughness: 0.35,
});

/** 地面星光点：小而亮，emissive 青白。 */
const starDotMaterial = createSceneMaterial({
  id: 'starlight-courtyard-star-dot',
  model: 'standard',
  baseColor: '#EAFBF6',
  emissive: '#A9EDE2',
  emissiveIntensity: 2.4,
  roughness: 0.4,
});

const tuftMaterial = createSceneMaterial({
  id: 'starlight-courtyard-tuft',
  model: 'standard',
  baseColor: '#4E7A3A',
  roughness: 0.95,
});

const tuftLightMaterial = createSceneMaterial({
  id: 'starlight-courtyard-tuft-light',
  model: 'standard',
  baseColor: '#639050',
  roughness: 0.95,
});

/** 草丛间的小花：呼应微光的淡青，低强度 emissive，不抢星光点。 */
const glowFlowerMaterial = createSceneMaterial({
  id: 'starlight-courtyard-glow-flower',
  model: 'standard',
  baseColor: '#BFEFE8',
  emissive: '#8FE0D2',
  emissiveIntensity: 0.7,
  roughness: 0.6,
});

const ORB_CENTER_Y = 1.5;
const TUFT_COUNT = 26;
const TUFT_FIELD_RADIUS = 2.9;
/** 星光环外沿 0.85 + 点半径，草丛不进 1.05 内，留出装置的净空。 */
const TUFT_INNER_CLEARANCE = 1.05;

/** 一丛低草：压扁的半球感小丘（球体压扁），原点在坪面落点。 */
function createTuft(light: boolean): Group {
  const tuft = new Group();
  const blob = createScenePrimitiveObject(
    { geometry: { type: 'sphere', radius: 0.09, segments: 8 } },
    light ? tuftLightMaterial : tuftMaterial,
  );
  blob.position.y = 0.015;
  blob.scale.set(1, 0.55, 1);
  tuft.add(blob);
  return tuft;
}

/** 一朵淡青小花：细茎 + 小球花头，呼应微光的色。 */
function createGlowFlower(): Group {
  const flower = new Group();
  const stem = createScenePrimitiveObject(
    { geometry: { type: 'cylinder', radius: 0.01, height: 0.13, segments: 5 } },
    tuftMaterial,
  );
  stem.position.y = 0.065;
  flower.add(stem);
  const head = createScenePrimitiveObject(
    { geometry: { type: 'sphere', radius: 0.032, segments: 8 } },
    glowFlowerMaterial,
  );
  head.position.y = 0.15;
  flower.add(head);
  return flower;
}

/**
 * 「微光」本体：半透明外壳 + 内纹子组（核 + 三环）。
 * 内纹子组命名 ORB_CORE_GROUP_NAME，静态倾角构图，旋转待系统接入。
 */
function createStarlightOrb(orbEmissiveIntensity: number): Group {
  const orb = new Group();

  const core = new Group();
  core.name = ORB_CORE_GROUP_NAME;

  const nucleus = createScenePrimitiveObject(
    { geometry: { type: 'sphere', radius: 0.1, segments: 16 } },
    orbCoreMaterial,
  );
  core.add(nucleus);

  // 三个细环：半径递增、倾角各异，像球里缓缓交错的光纹轨道。
  const rings: ReadonlyArray<{
    radius: number;
    rotation: readonly [number, number, number];
  }> = [
    { radius: 0.17, rotation: [1.1, 0.2, 0.35] },
    { radius: 0.225, rotation: [0.35, 0.9, -0.55] },
    { radius: 0.28, rotation: [1.45, -0.5, 0.9] },
  ];
  for (const ring of rings) {
    const torus = createScenePrimitiveObject(
      {
        geometry: {
          type: 'torus',
          radius: ring.radius,
          tube: 0.007,
          radialSegments: 6,
          tubularSegments: 48,
        },
      },
      orbRingMaterial,
    );
    torus.rotation.set(...ring.rotation);
    core.add(torus);
  }
  orb.add(core);

  // 外壳：半透明球，emissive 给整球一层均匀的青光。
  // MeshStandardMaterial 直建（同 goddess-lamp 灯泡的做法），因为
  // 透明度与深度写入要逐字段控制：depthWrite 关掉，避免外壳把
  // 内纹的深度挡住；内纹是不透明发光体，先于透明外壳绘制。
  const shellMaterial = new MeshStandardMaterial({
    color: '#CDEEE7',
    emissive: '#8FE0D2',
    emissiveIntensity: orbEmissiveIntensity,
    roughness: 0.15,
    transparent: true,
    opacity: 0.45,
    depthWrite: false,
  });
  const shell = createScenePrimitiveObject(
    { geometry: { type: 'sphere', radius: 0.34, segments: 24 } },
    shellMaterial,
  );
  orb.add(shell);

  orb.position.y = ORB_CENTER_Y;
  return orb;
}

/** 球下星光装置：两圈同心 emissive 小点阵，绕着球的地面投影。 */
function createStarRing(): Group {
  const ring = new Group();
  const circles: ReadonlyArray<{ radius: number; count: number }> = [
    { radius: 0.55, count: 10 },
    { radius: 0.85, count: 14 },
  ];
  for (const circle of circles) {
    for (let i = 0; i < circle.count; i++) {
      const angle = (i / circle.count) * Math.PI * 2;
      const dot = createScenePrimitiveObject(
        { geometry: { type: 'sphere', radius: 0.022, segments: 8 } },
        starDotMaterial,
      );
      dot.position.set(
        Math.cos(angle) * circle.radius,
        0.055,
        Math.sin(angle) * circle.radius,
      );
      ring.add(dot);
    }
  }
  // 正中一颗稍大的点，锚住球心在地面的落点。
  const heart = createScenePrimitiveObject(
    { geometry: { type: 'sphere', radius: 0.032, segments: 8 } },
    starDotMaterial,
  );
  heart.position.y = 0.055;
  ring.add(heart);
  return ring;
}

export function createStarlightCourtyard(
  options: { orbEmissiveIntensity?: number } = {},
): Group {
  const courtyard = new Group();

  // 开阔草坪：比园地略亮的一片圆坪，顶面 y=0.04。
  const lawn = createScenePrimitiveObject(
    { geometry: { type: 'cylinder', radius: 3.2, height: 0.04, segments: 36 } },
    lawnMaterial,
  );
  lawn.position.y = 0.02;
  courtyard.add(lawn);

  courtyard.add(createStarRing());
  courtyard.add(createStarlightOrb(options.orbEmissiveIntensity ?? 1.1));

  // 低矮花草：金角螺旋（确定性公式），避开星光装置 1.05 m 净空；
  // 每第 6 丛换成一朵淡青小花。
  const goldenAngle = 2.399963;
  for (let i = 0; i < TUFT_COUNT; i++) {
    const angle = i * goldenAngle;
    const radius =
      TUFT_INNER_CLEARANCE +
      (TUFT_FIELD_RADIUS - TUFT_INNER_CLEARANCE) *
        Math.sqrt((i + 0.5) / TUFT_COUNT);
    const x = Math.cos(angle) * radius;
    const z = Math.sin(angle) * radius;
    const plant = i % 6 === 5 ? createGlowFlower() : createTuft(i % 2 === 0);
    plant.position.set(x, 0.04, z);
    courtyard.add(plant);
  }

  return courtyard;
}
