/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { AssetType, defineAssets } from '@iwsdk/core';
import {
  createGardenGround,
  createGoddessLamp,
} from './scene-assets/garden.scene-asset.js';
import { createGardenGate } from './scene-assets/garden-gate.scene-asset.js';
import {
  createLotusPavilion,
  createLotusPond,
} from './scene-assets/lotus-pavilion.scene-asset.js';
import { createGoddessBench } from './scene-assets/goddess-bench.scene-asset.js';
import { createSerpentGarden } from './scene-assets/serpent-garden.scene-asset.js';
import { createStarlightCourtyard } from './scene-assets/ai-starlight-courtyard.scene-asset.js';
import { createStillnessRing } from './scene-assets/stillness-ring.scene-asset.js';
import { createMusicPavilion } from './scene-assets/music-pavilion.scene-asset.js';
import { createMeditationSeat } from './scene-assets/meditation-seat.scene-asset.js';
import { createComedyTheater } from './scene-assets/comedy-theater.scene-asset.js';
import { createLandingMarker } from './scene-assets/landing-marker.scene-asset.js';
import { createBenchNoteMarker } from './scene-assets/bench-note-marker.scene-asset.js';

/**
 * 资产清单（运行时与编辑器共用，必须确定性、无副作用）。
 * 骨架三件：花园地面、女神之灯、欢迎面板；第一阶段新增：
 * 花园之门、入口首句面板、莲花亭与莲池（空间 1 · 呼唤）；
 * 第二阶段新增：真曦的长椅与长椅面板（空间 2 · 回应）、
 * 蛇的自由花园与蛇园面板（空间 3 · 交融）；第三阶段新增：
 * AI 星光庭院与星光面板（空间 4 · 内在之光）、归于宁静石环
 * （空间 5，无面板）。第五阶段新增：音乐亭与音乐亭面板
 * （空间 6 · 弧外旁支，主「听与舞」）、冥想地坐席与悬置的
 * Sri Chakra 光轮（空间 7 · 弧外旁支，主「坐与观想」，无面板）。
 * 第四阶段新增：落点标记——每个目标空间一枚独立登记（材质实例
 * 不共享，段落系统逐个调亮度），外加入口锚环与归静处的五枚回访
 * 小点；另加莲花亭用的一块兜底提示小面板（interaction-hint）。
 * 第六阶段新增：每日一笑馆与馆名牌、选集面板、银幕标题卡
 * （空间 8 · 弧外旁支，常设喜剧展馆；目录在
 * public/comedy-catalog.json，点播待公开托管）。
 * 后续空间的资产就绪后逐个加到这里（登记表见 src/spaces/spaces.ts）。
 */

const publicAssetUrl = (filePath: string): string =>
  `${import.meta.env.BASE_URL}${filePath.replace(/^\/+/u, '')}`;

export default defineAssets({
  'garden-ground': createGardenGround(),
  'goddess-lamp': createGoddessLamp(),
  'welcome-panel': {
    url: publicAssetUrl('ui/welcome.uikitml'),
    type: AssetType.UIKitML,
    name: 'Welcome Panel',
  },
  'garden-gate': createGardenGate(),
  'gate-panel': {
    url: publicAssetUrl('ui/gate.uikitml'),
    type: AssetType.UIKitML,
    name: 'Gate Panel',
  },
  'lotus-pavilion': createLotusPavilion(),
  'lotus-pond': createLotusPond(),
  'goddess-bench': createGoddessBench(),
  'bench-panel': {
    url: publicAssetUrl('ui/bench.uikitml'),
    type: AssetType.UIKitML,
    name: 'Bench Panel',
  },
  'serpent-garden': createSerpentGarden(),
  'serpent-panel': {
    url: publicAssetUrl('ui/serpent.uikitml'),
    type: AssetType.UIKitML,
    name: 'Serpent Panel',
  },
  'ai-starlight-courtyard': createStarlightCourtyard(),
  'starlight-panel': {
    url: publicAssetUrl('ui/starlight.uikitml'),
    type: AssetType.UIKitML,
    name: 'Starlight Panel',
  },
  'stillness-ring': createStillnessRing(),
  'music-pavilion': createMusicPavilion(),
  'music-panel': {
    url: publicAssetUrl('ui/music.uikitml'),
    type: AssetType.UIKitML,
    name: 'Music Panel',
  },
  'meditation-seat': createMeditationSeat(),
  // 每日一笑馆（空间 8 · 弧外旁支）：有墙小馆 + 海报墙 + 银幕
  // （未开播的微光面）；馆名牌立馆外，选集面板与银幕标题卡在
  // 馆内。目录数据层 src/spaces/comedy-catalog.ts，系统
  // comedy-catalog-system.ts；点播待公开托管。
  'comedy-theater': createComedyTheater(),
  'comedy-name-panel': {
    url: publicAssetUrl('ui/comedy-name.uikitml'),
    type: AssetType.UIKitML,
    name: 'Comedy Name Panel',
  },
  'comedy-catalog-panel': {
    url: publicAssetUrl('ui/comedy-catalog.uikitml'),
    type: AssetType.UIKitML,
    name: 'Comedy Catalog Panel',
  },
  'comedy-screen-panel': {
    url: publicAssetUrl('ui/comedy-screen.uikitml'),
    type: AssetType.UIKitML,
    name: 'Comedy Screen Panel',
  },
  // 落点标记：每次 createLandingMarker 调用新建材质实例，逐个登记
  // 是为了让段落系统能独立驱动每个标记的 emissive 脉冲。
  'landing-marker-entrance': createLandingMarker({ accent: '#FFC46B' }),
  'landing-marker-lotus': createLandingMarker({ accent: '#FFC46B' }),
  'landing-marker-bench': createLandingMarker({ accent: '#FFB37A' }),
  'landing-marker-serpent': createLandingMarker({ accent: '#FFD98A' }),
  'landing-marker-starlight': createLandingMarker({ accent: '#A9EDE2' }),
  'landing-marker-stillness': createLandingMarker({ accent: '#FFE9C4' }),
  'revisit-marker-lotus': createLandingMarker({
    variant: 'revisit',
    accent: '#FFC46B',
  }),
  'revisit-marker-bench': createLandingMarker({
    variant: 'revisit',
    accent: '#FFB37A',
  }),
  'revisit-marker-serpent': createLandingMarker({
    variant: 'revisit',
    accent: '#FFD98A',
  }),
  'revisit-marker-starlight': createLandingMarker({
    variant: 'revisit',
    accent: '#A9EDE2',
  }),
  'revisit-marker-stillness': createLandingMarker({
    variant: 'revisit',
    accent: '#FFE9C4',
  }),
  // 弧外旁支（音乐亭 / 冥想地）的回访小点：与五段弧小点同排陈列
  // 于归静处，自由回访模式下点亮可达（见 arc-system.ts）。
  'revisit-marker-music': createLandingMarker({
    variant: 'revisit',
    accent: '#FFB84D',
  }),
  'revisit-marker-meditation': createLandingMarker({
    variant: 'revisit',
    accent: '#F5D98B',
  }),
  'revisit-marker-comedy': createLandingMarker({
    variant: 'revisit',
    accent: '#FF9E7A',
  }),
  'interaction-hint-panel': {
    url: publicAssetUrl('ui/interaction-hint.uikitml'),
    type: AssetType.UIKitML,
    name: 'Interaction Hint Panel',
  },
  // 长椅留言层（数字城城门口留言版在园中的落点）：椅面之下的
  // 微光标记（挂在 goddess-bench 节点下作子节点）与留言面板。
  // 数据层见 src/spaces/bench-notes.ts，访客侧系统见
  // bench-notes-system.ts；只在自由回访模式下显形。
  'bench-note-marker': createBenchNoteMarker(),
  'bench-notes-panel': {
    url: publicAssetUrl('ui/bench-notes.uikitml'),
    type: AssetType.UIKitML,
    name: 'Bench Notes Panel',
  },
});
