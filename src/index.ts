/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { World } from '@iwsdk/core';
import projectOptions from 'virtual:iwsdk-project';
import { PanelSystem } from './panel.js';
import { primeSongAudio } from './audio/song-bus.js';
import { ArcSystem } from './spaces/arc-system.js';
import { PavilionSystem } from './spaces/pavilion-system.js';
import { SongSystem } from './audio/song-system.js';
import { MeditationSystem } from './spaces/meditation-system.js';
import { BenchNotesSystem } from './spaces/bench-notes-system.js';
import { ComedyCatalogSystem } from './spaces/comedy-catalog-system.js';
import { CjkFontSystem } from './cjk-font.js';

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
  // CjkFontSystem（中文字体注册）：把预生成的 Noto Sans SC 子集
  // MSDF 图集注入各面板根元素，修复中文白方块（见 cjk-font.ts）。
  world.registerSystem(CjkFontSystem);
  // PavilionSystem（歌亭改版，2026-11-14）：歌亭单线新导航（注视
  // 亭身闪光进入、退出标志回中央）、轻纱/莲池活画、B 案画像开关。
  world.registerSystem(PavilionSystem);
  // SongSystem（src/audio/）：《女神之歌》VR 改编版播放与音频
  // 电平发布（歌亭段落灯的呼吸驱动源）。
  world.registerSystem(SongSystem);

  // PWA 装机自动进入（iwsdk-pwa-packaging 步骤 1）：从应用库图标
  // 启动的已安装 PWA 没有 2D 页面可点 Enter XR，图标点击即用户
  // 激活，由应用自己花掉它。getDigitalGoodsService 只存在于
  // 已安装环境，普通浏览器标签页永不触发、仍走欢迎板按钮。
  const nav = navigator as Navigator & {
    xr?: { isSessionSupported?: (mode: string) => Promise<boolean> };
  };
  if ('getDigitalGoodsService' in window && nav.xr?.isSessionSupported) {
    nav.xr
      .isSessionSupported('immersive-vr')
      .then((supported) => {
        if (supported) {
          // 图标点开即用户激活：顺手完成双保险第一重点火。
          primeSongAudio();
          world.launchXR();
        }
      })
      .catch(() => {});
  }
});
