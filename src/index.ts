/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { World } from '@iwsdk/core';
import projectOptions from 'virtual:iwsdk-project';
import { PanelSystem } from './panel.js';
import { ArcSystem } from './spaces/arc-system.js';
import { MeditationSystem } from './spaces/meditation-system.js';
import { BenchNotesSystem } from './spaces/bench-notes-system.js';
import { ComedyCatalogSystem } from './spaces/comedy-catalog-system.js';

World.create(
  document.getElementById('scene-container') as HTMLDivElement,
  projectOptions,
).then((world) => {
  // PanelSystem 负责欢迎面板上的 Enter XR / Exit 按钮（进入/退出 VR）。
  world.registerSystem(PanelSystem);
  // ArcSystem（第四阶段）：五段弧段落状态机——手势推进、落点标记
  // 换位、段落灯呼吸（applySpaceLampAudioLevel 的驱动方）。
  world.registerSystem(ArcSystem);
  // MeditationSystem（空间 7 · 冥想地）：Sri Chakra 光轮的收束
  // 动画——测试正弦供 level，音频阶段换歌曲包络（见该文件头）。
  world.registerSystem(MeditationSystem);
  // BenchNotesSystem（长椅留言层）：椅下微光标记 + 留言面板，只在
  // 自由回访模式下显形；同一份字条数据经 bench-notes.ts 暴露为
  // 机器可读层（bench-notes.json + window.__EDEN_BENCH_NOTES__）。
  world.registerSystem(BenchNotesSystem);
  // ComedyCatalogSystem（空间 8 · 每日一笑馆）：载入剧集目录
  // （public/comedy-catalog.json）、填选集面板、点选后经
  // presentEpisode 把标题卡交给银幕（点播待公开托管）。
  world.registerSystem(ComedyCatalogSystem);
  // 后续系统在此登记：空间音频（src/audio/）。
});
