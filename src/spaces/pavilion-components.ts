/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { createComponent, Types } from '@iwsdk/core';

/**
 * 歌亭退出标志的归属声明（歌亭改版 · 施工单第二节「出」）。
 * PavilionSystem 在启动时挂到 pavilion-exit-panel 场景实体上，
 * 使其 Pressed 状态可被单独订阅——点按标志即回园子中央。
 */
export const PavilionExitSign = createComponent('PavilionExitSign', {
  version: { type: Types.Int8, default: 1 },
});
