/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { createComponent, Types } from '@iwsdk/core';

/**
 * 段落状态机的 ECS 声明（无 system 依赖，登记在 src/components.ts）。
 *
 * 阶段编号与 src/spaces/spaces.ts 的 SPACES.index 对齐并向前扩一位：
 * 0 = 入口（序），1 = 莲花亭·呼唤，2 = 长椅·回应，3 = 蛇园·交融，
 * 4 = 星光庭院·内在之光，5 = 归于宁静。过渡阶段：0 静止，
 * 1 淡出，2 停驻（已换位），3 淡入。
 */
export const ArcDirector = createComponent('ArcDirector', {
  stage: { type: Types.Int8, default: 0 },
  gestureComplete: { type: Types.Boolean, default: true },
  freeRevisit: { type: Types.Boolean, default: false },
  transitionPhase: { type: Types.Int8, default: 0 },
  activeTargetStage: { type: Types.Int8, default: 1 },
});

/** 落点标记的归属声明：由 ArcSystem 在启动时挂到场景标记实体上。 */
export const LandingMarker = createComponent('LandingMarker', {
  targetStage: { type: Types.Int8, default: 0 },
  revisit: { type: Types.Boolean, default: false },
});
