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
 * 歌亭（空间 1 · 呼唤）与其前的莲池，全部程序化低模生成。
 *
 * 2026-11-14 歌亭改版（施工单定版，主视觉基准：
 * references/song-pavilion-lotus-pond-key-visual-2026-11-13.jpg）：
 * 亭身改白金大理石、红锥顶改粉色穹顶（金环压边、莲苞顶珠），
 * 柱间垂**轻纱**（组名 pavilion-curtains，逐幅 pavilion-curtain，
 * 由 PavilionSystem 做摆动动画——本景签名动作「轻纱迎风」），
 * 亭中一张空座 + 一把维纳琴静置（pavilion-seat 组，不添人物），
 * 中央仍是派生自 goddess-lamp 的段落灯（场景节点 PointLight 照明）。
 *
 * 池：石圈 + 涟漪水面（Lathe 正弦剖面，顶点波纹、零贴图）。活画
 * 挂点（PavilionSystem 逐帧驱动，只动光与水）：水面 pond-water、
 * 薄雾 pond-mist-0/1、斜射光束 pond-sunbeam、莲心微光。
 *
 * 莲花 6 朵，位置/朝向/大小全部写死（资产清单在双 realm 求值，
 * 必须确定性，禁用随机数）：五瓣低模锥瓣 + 发光花心 + 一片莲叶。
 */

const marbleMaterial = createSceneMaterial({
  id: 'lotus-pavilion-marble',
  model: 'standard',
  baseColor: '#EFE7D6',
  roughness: 0.55,
});

const columnMaterial = createSceneMaterial({
  id: 'lotus-pavilion-column',
  model: 'standard',
  baseColor: '#F5F0E2',
  roughness: 0.5,
});

const domeMaterial = createSceneMaterial({
  id: 'lotus-pavilion-dome',
  model: 'standard',
  baseColor: '#E9A9BE',
  roughness: 0.4,
  metalness: 0.15,
});

const goldMaterial = createSceneMaterial({
  id: 'lotus-pavilion-gold',
  model: 'standard',
  baseColor: '#C9A227',
  roughness: 0.35,
  metalness: 0.85,
});

/** 轻纱：无光照半透明薄片，摆动时不产生高光闪烁。 */
const curtainMaterial = createSceneMaterial({
  id: 'lotus-pavilion-curtain',
  model: 'basic',
  baseColor: '#FFF6E8',
  opacity: 0.4,
  side: 'double',
});

const cushionMaterial = createSceneMaterial({
  id: 'lotus-pavilion-cushion',
  model: 'standard',
  baseColor: '#D98CA6',
  roughness: 0.8,
});

const veenaWoodMaterial = createSceneMaterial({
  id: 'lotus-pavilion-veena-wood',
  model: 'standard',
  baseColor: '#6B4226',
  roughness: 0.55,
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
    marbleMaterial,
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
    marbleMaterial,
  );
  platform.position.y = 0.13;
  pavilion.add(platform);

  const platformTrim = createScenePrimitiveObject(
    {
      geometry: { type: 'torus', radius: 2.34, tube: 0.022, radialSegments: 8, tubularSegments: 40 },
    },
    goldMaterial,
  );
  platformTrim.rotation.x = Math.PI / 2;
  platformTrim.position.y = 0.2;
  pavilion.add(platformTrim);

  const floorY = 0.2;
  const columnHeight = 2.1;
  const columnRadius = 1.85;
  for (let i = 0; i < 6; i++) {
    const angle = (i / 6) * Math.PI * 2;
    const column = createScenePrimitiveObject(
      {
        geometry: { type: 'cylinder', radius: 0.075, height: columnHeight, segments: 10 },
      },
      columnMaterial,
    );
    column.position.set(
      Math.cos(angle) * columnRadius,
      floorY + columnHeight / 2,
      Math.sin(angle) * columnRadius,
    );
    pavilion.add(column);
    const capital = createScenePrimitiveObject(
      {
        geometry: { type: 'cylinder', radius: 0.12, height: 0.05, segments: 10 },
      },
      goldMaterial,
    );
    capital.position.set(
      Math.cos(angle) * columnRadius,
      floorY + columnHeight - 0.02,
      Math.sin(angle) * columnRadius,
    );
    pavilion.add(capital);
  }

  const roofBaseY = floorY + columnHeight;

  // 檐口环：白石圈梁，穹顶坐落其上。
  const entablature = createScenePrimitiveObject(
    {
      geometry: { type: 'cylinder', radius: 2.38, height: 0.12, segments: 24 },
    },
    marbleMaterial,
  );
  entablature.position.y = roofBaseY + 0.06;
  pavilion.add(entablature);

  // 粉色穹顶：球体压扁，下半沉入檐口环，只取上半的圆润剪影。
  const dome = createScenePrimitiveObject(
    { geometry: { type: 'sphere', radius: 2.15, segments: 24 } },
    domeMaterial,
  );
  dome.scale.set(1, 0.62, 1);
  dome.position.y = roofBaseY + 0.1;
  pavilion.add(dome);

  const domeBaseRing = createScenePrimitiveObject(
    {
      geometry: { type: 'torus', radius: 2.14, tube: 0.03, radialSegments: 8, tubularSegments: 40 },
    },
    goldMaterial,
  );
  domeBaseRing.rotation.x = Math.PI / 2;
  domeBaseRing.position.y = roofBaseY + 0.16;
  pavilion.add(domeBaseRing);

  const domeMidRing = createScenePrimitiveObject(
    {
      geometry: { type: 'torus', radius: 1.52, tube: 0.022, radialSegments: 8, tubularSegments: 36 },
    },
    goldMaterial,
  );
  domeMidRing.rotation.x = Math.PI / 2;
  domeMidRing.position.y = roofBaseY + 0.78;
  pavilion.add(domeMidRing);

  // 顶珠：金 stem + 粉色莲苞（主视觉题眼）。
  const finialStem = createScenePrimitiveObject(
    {
      geometry: { type: 'cylinder', radius: 0.03, height: 0.14, segments: 8 },
    },
    goldMaterial,
  );
  finialStem.position.y = roofBaseY + 1.47;
  pavilion.add(finialStem);
  const finialBud = createScenePrimitiveObject(
    { geometry: { type: 'cone', radius: 0.1, height: 0.26, segments: 10 } },
    domeMaterial,
  );
  finialBud.position.y = roofBaseY + 1.66;
  pavilion.add(finialBud);

  // 轻纱垂幔：六幅，挂在柱间檐下；支点在上沿，摆动绕支点（系统驱动）。
  const curtains = new Group();
  curtains.name = 'pavilion-curtains';
  for (let i = 0; i < 6; i++) {
    const angle = ((i + 0.5) / 6) * Math.PI * 2;
    const holder = new Group();
    holder.name = 'pavilion-curtain';
    holder.position.set(
      Math.cos(angle) * 1.8,
      roofBaseY + 0.02,
      Math.sin(angle) * 1.8,
    );
    holder.rotation.y = -angle + Math.PI / 2;
    const drape = createScenePrimitiveObject(
      {
        geometry: { type: 'box', size: [1.0, 1.5, 0.015] },
      },
      curtainMaterial,
    );
    drape.position.y = -0.78;
    holder.add(drape);
    curtains.add(holder);
  }
  pavilion.add(curtains);

  // 空座 + 维纳琴（静置）：座在灯后左侧，琴斜倚座上——只留剪影，
  // 「琴声仿佛就要响起」的将启未启，不添人物。
  const seat = new Group();
  seat.name = 'pavilion-seat';
  seat.position.set(-0.42, floorY, 0.72);
  seat.rotation.y = 0.5;
  const daybed = createScenePrimitiveObject(
    {
      geometry: { type: 'box', size: [1.5, 0.22, 0.62] },
    },
    marbleMaterial,
  );
  daybed.position.y = 0.11;
  seat.add(daybed);
  const cushion = createScenePrimitiveObject(
    {
      geometry: { type: 'box', size: [1.42, 0.1, 0.54] },
    },
    cushionMaterial,
  );
  cushion.position.y = 0.27;
  seat.add(cushion);
  const backrest = createScenePrimitiveObject(
    {
      geometry: { type: 'box', size: [1.42, 0.34, 0.09] },
    },
    cushionMaterial,
  );
  backrest.position.set(0, 0.42, -0.28);
  backrest.rotation.x = -0.18;
  seat.add(backrest);

  const veena = new Group();
  veena.position.set(0.05, 0.36, 0.02);
  veena.rotation.set(0, 0.15, 0.42);
  const gourdMain = createScenePrimitiveObject(
    { geometry: { type: 'sphere', radius: 0.17, segments: 14 } },
    veenaWoodMaterial,
  );
  gourdMain.position.x = -0.34;
  veena.add(gourdMain);
  const gourdSmall = createScenePrimitiveObject(
    { geometry: { type: 'sphere', radius: 0.1, segments: 12 } },
    veenaWoodMaterial,
  );
  gourdSmall.position.set(0.38, 0.09, 0);
  veena.add(gourdSmall);
  const neck = createScenePrimitiveObject(
    {
      geometry: { type: 'box', size: [0.78, 0.045, 0.07] },
    },
    veenaWoodMaterial,
  );
  neck.position.x = 0.05;
  veena.add(neck);
  const pegbox = createScenePrimitiveObject(
    {
      geometry: { type: 'box', size: [0.12, 0.09, 0.06] },
    },
    goldMaterial,
  );
  pegbox.position.set(0.48, 0.03, 0);
  veena.add(pegbox);
  seat.add(veena);
  pavilion.add(seat);

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

/** 晨光光束：极低透明度的暖色斜面，只作光感，不作实体。 */
const sunbeamMaterial = createSceneMaterial({
  id: 'lotus-pond-sunbeam',
  model: 'basic',
  baseColor: '#FFDF9E',
  opacity: 0.05,
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

  // 涟漪水面：Lathe 剖面沿半径作正弦起伏，顶点波纹 + 真实法线，零贴图。
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
  water.name = 'pond-water';
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
  mistLayers.forEach((layer, index) => {
    const mist = createScenePrimitiveObject(
      { geometry: { type: 'cylinder', radius: layer.radius, height: 0.01, segments: 24 } },
      layer.material,
    );
    mist.position.y = layer.y;
    mist.name = `pond-mist-${index}`;
    pond.add(mist);
  });

  // 晨光斜束：自左上（晨光方向光一侧）斜落池面的一片暖光。
  const sunbeam = createScenePrimitiveObject(
    {
      geometry: { type: 'box', size: [4.4, 0.015, 1.25] },
    },
    sunbeamMaterial,
  );
  sunbeam.name = 'pond-sunbeam';
  sunbeam.position.set(0.5, 1.05, -0.5);
  sunbeam.rotation.set(0.12, 0.3, -0.42);
  pond.add(sunbeam);

  return pond;
}
