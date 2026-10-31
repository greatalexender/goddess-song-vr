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
 * 每日一笑馆（空间 8 · 园子的笑声存档），全部程序化低模生成。
 *
 * 与音乐亭的视觉分工：音乐亭是无墙的敞亭（圆台、伞顶、舞池）；
 * 笑馆反着来——**有墙、有门洞**的一座小馆：进门左手右手是海报
 * 墙，正对面是一块银幕。银幕 v1 未开播：深色微光面（emissive
 * 微亮）表示待播，点选剧集后由 ComedyCatalogSystem 提亮微光并
 * 在银幕面板上亮标题卡；将来公开托管后把视频纹理挂到名为
 * comedy-screen 的这块网格上即可点播（扩展点见
 * src/spaces/comedy-catalog.ts 的 presentEpisode）。
 *
 * 本馆零点光源（全场点光源守恒 4 盏已满）：银幕微光、海报的
 * 颜色都是材质本身，不照物。本地朝向：-Z 为馆门（来客方向），
 * 银幕在 +Z 馆底。场景编排（园南空地位置）在
 * public/scenes/main.iwsdk.scene.json。
 */

const wallMaterial = createSceneMaterial({
  id: 'comedy-theater-wall',
  model: 'standard',
  baseColor: '#D9CCB0',
  roughness: 0.95,
});

const floorMaterial = createSceneMaterial({
  id: 'comedy-theater-floor',
  model: 'standard',
  baseColor: '#8A6F4D',
  roughness: 0.8,
});

const roofMaterial = createSceneMaterial({
  id: 'comedy-theater-roof',
  model: 'standard',
  baseColor: '#6E3A2E',
  roughness: 0.7,
});

const goldMaterial = createSceneMaterial({
  id: 'comedy-theater-gold',
  model: 'standard',
  baseColor: '#C9A227',
  roughness: 0.35,
  metalness: 0.85,
});

const screenFrameMaterial = createSceneMaterial({
  id: 'comedy-theater-screen-frame',
  model: 'standard',
  baseColor: '#3A3226',
  roughness: 0.5,
  metalness: 0.6,
});

/** 银幕面：深色 + 一层靛蓝微光（未开播的待播读法）。 */
const screenMaterial = createSceneMaterial({
  id: 'comedy-theater-screen',
  model: 'standard',
  baseColor: '#0B0E1A',
  emissive: '#2A3560',
  emissiveIntensity: 0.35,
  roughness: 0.4,
});

const benchMaterial = createSceneMaterial({
  id: 'comedy-theater-bench',
  model: 'standard',
  baseColor: '#7A3B2E',
  roughness: 0.85,
});

/** 海报底色：压暗的展览色卡，顺序写死（资产双 realm 须确定性）。 */
const POSTER_COLORS = [
  '#B5542D',
  '#2D6E6A',
  '#C9A227',
  '#5B4A8A',
  '#7A3B2E',
  '#2F5D8A',
  '#A03D63',
  '#4A7A3B',
] as const;

const posterFaceMaterials = POSTER_COLORS.map((color, index) =>
  createSceneMaterial({
    id: `comedy-theater-poster-${index}`,
    model: 'standard',
    baseColor: color,
    roughness: 0.65,
  }),
);

/** 一张海报：金框 + 彩面，本地 +Z 为正面。 */
function createPoster(colorIndex: number): Group {
  const poster = new Group();
  const frame = createScenePrimitiveObject(
    { geometry: { type: 'box', size: [0.7, 0.96, 0.03] } },
    goldMaterial,
  );
  poster.add(frame);
  const face = createScenePrimitiveObject(
    { geometry: { type: 'box', size: [0.6, 0.86, 0.036] } },
    posterFaceMaterials[colorIndex % posterFaceMaterials.length],
  );
  poster.add(face);
  return poster;
}

/** 一排长凳：凳面 + 两只凳脚，面朝 +Z（银幕方向）。 */
function createBenchRow(): Group {
  const row = new Group();
  const slab = createScenePrimitiveObject(
    { geometry: { type: 'box', size: [2.6, 0.09, 0.48] } },
    benchMaterial,
  );
  slab.position.y = 0.42;
  row.add(slab);
  for (const x of [-1.1, 1.1]) {
    const foot = createScenePrimitiveObject(
      { geometry: { type: 'box', size: [0.12, 0.38, 0.4] } },
      benchMaterial,
    );
    foot.position.set(x, 0.19, 0);
    row.add(foot);
  }
  return row;
}

export function createComedyTheater(): Group {
  const theater = new Group();

  // 地面：一方木台（馆的地板），与园地草色分开。
  const floor = createScenePrimitiveObject(
    { geometry: { type: 'box', size: [6.8, 0.08, 5.6] } },
    floorMaterial,
  );
  floor.position.y = 0.04;
  theater.add(floor);

  const wallBaseY = 0.08;
  const wallHeight = 2.7;
  const wallCenterY = wallBaseY + wallHeight / 2;

  // 馆底墙（+Z）：银幕挂在它内侧。
  const backWall = createScenePrimitiveObject(
    { geometry: { type: 'box', size: [6.8, wallHeight, 0.15] } },
    wallMaterial,
  );
  backWall.position.set(0, wallCenterY, 2.8);
  theater.add(backWall);

  // 两侧墙。
  for (const side of [-1, 1]) {
    const sideWall = createScenePrimitiveObject(
      { geometry: { type: 'box', size: [0.15, wallHeight, 5.75] } },
      wallMaterial,
    );
    sideWall.position.set(side * 3.4, wallCenterY, 0);
    theater.add(sideWall);
  }

  // 门面墙（-Z）：两段墙 + 门楣，中间留 1.6 m 门洞。
  for (const side of [-1, 1]) {
    const frontSegment = createScenePrimitiveObject(
      { geometry: { type: 'box', size: [2.6, wallHeight, 0.15] } },
      wallMaterial,
    );
    frontSegment.position.set(side * 2.0, wallCenterY, -2.8);
    theater.add(frontSegment);
  }
  const lintel = createScenePrimitiveObject(
    { geometry: { type: 'box', size: [1.75, 0.7, 0.15] } },
    wallMaterial,
  );
  lintel.position.set(0, wallBaseY + 2.0 + 0.35, -2.8);
  theater.add(lintel);

  // 门口两根细柱 + 门槛金条：影院门脸的读法，不添光源。
  for (const side of [-1, 1]) {
    const pillar = createScenePrimitiveObject(
      {
        geometry: {
          type: 'cylinder',
          radius: 0.055,
          height: 2.1,
          segments: 8,
        },
      },
      goldMaterial,
    );
    pillar.position.set(side * 1.0, wallBaseY + 1.05, -3.0);
    theater.add(pillar);
  }
  const threshold = createScenePrimitiveObject(
    { geometry: { type: 'box', size: [1.7, 0.03, 0.3] } },
    goldMaterial,
  );
  threshold.position.set(0, wallBaseY + 0.015, -2.85);
  theater.add(threshold);

  // 屋顶：一块平石板 + 前缘金线 + 顶上一颗金珠（与音乐亭伞顶区分）。
  const roof = createScenePrimitiveObject(
    { geometry: { type: 'box', size: [7.3, 0.12, 6.1] } },
    roofMaterial,
  );
  roof.position.set(0, wallBaseY + wallHeight + 0.06, 0);
  theater.add(roof);
  const roofTrim = createScenePrimitiveObject(
    { geometry: { type: 'box', size: [7.3, 0.05, 0.05] } },
    goldMaterial,
  );
  roofTrim.position.set(0, wallBaseY + wallHeight - 0.02, -3.06);
  theater.add(roofTrim);
  const finial = createScenePrimitiveObject(
    { geometry: { type: 'sphere', radius: 0.08, segments: 12 } },
    goldMaterial,
  );
  finial.position.set(0, wallBaseY + wallHeight + 0.2, 0);
  theater.add(finial);

  // 银幕：馆底墙内侧正中——深框 + 微光面。网格命名 comedy-screen，
  // 是将来托管视频纹理的挂点（见 comedy-catalog.ts 的扩展点）。
  const screenFrame = createScenePrimitiveObject(
    { geometry: { type: 'box', size: [3.9, 2.3, 0.06] } },
    screenFrameMaterial,
  );
  screenFrame.position.set(0, 1.62, 2.71);
  theater.add(screenFrame);
  const screen = createScenePrimitiveObject(
    { geometry: { type: 'box', size: [3.6, 2.0, 0.03] } },
    screenMaterial,
  );
  screen.name = 'comedy-screen';
  screen.position.set(0, 1.62, 2.69);
  theater.add(screen);

  // 海报墙：两侧墙内侧各 6 张（3 列 × 2 排），馆底墙银幕两侧
  // 再各 1 张——共 14 张。海报是陈设（彩面无字），可点选的目录
  // 在选集面板上（数据层驱动，两者分工见 comedy-catalog.ts）。
  const posterWall = new Group();
  posterWall.name = 'poster-wall';
  let posterIndex = 0;
  for (const side of [-1, 1]) {
    for (const z of [-1.7, 0, 1.7]) {
      for (const y of [1.15, 2.1]) {
        const poster = createPoster(posterIndex++);
        poster.position.set(side * 3.31, y, z);
        poster.rotation.y = side < 0 ? Math.PI / 2 : -Math.PI / 2;
        posterWall.add(poster);
      }
    }
  }
  for (const side of [-1, 1]) {
    const poster = createPoster(posterIndex++);
    poster.position.set(side * 2.62, 1.62, 2.71);
    poster.rotation.y = Math.PI;
    posterWall.add(poster);
  }
  theater.add(posterWall);

  // 两排观影长凳，面朝银幕。
  for (const z of [-0.9, 0.45]) {
    const benchRow = createBenchRow();
    benchRow.position.set(0, 0.08, z);
    theater.add(benchRow);
  }

  return theater;
}
