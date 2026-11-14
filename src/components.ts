/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { defineComponents } from '@iwsdk/core';
import { ArcDirector, LandingMarker } from './spaces/arc-components.js';
import { PavilionExitSign } from './spaces/pavilion-components.js';

// 第四阶段起登记段落状态机组件：ArcDirector（段落进度单例）与
// LandingMarker（落点标记归属）。声明在无 system 依赖的
// src/spaces/arc-components.ts，这里只做清单导出。
// 歌亭改版（2026-11-14）加 PavilionExitSign（歌亭退出标志归属），
// 声明在 src/spaces/pavilion-components.ts。
export default defineComponents([
  ArcDirector,
  LandingMarker,
  PavilionExitSign,
]);
