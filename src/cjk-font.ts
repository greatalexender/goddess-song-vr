/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * 中文字体注册（白方块修复）。
 *
 * 背景：@pmndrs/uikit 的 TTFLoader 运行时生成 MSDF 时字符集写死为
 * ASCII（DEFAULT_OPTIONS.charset），UIKitML 的 @font-face 声明即便
 * 挂上 Noto Sans SC 子集 TTF，也只会生成拉丁字形——中文仍是方块。
 * 因此这里改走预生成路线：构建期离线生成 Noto Sans SC 子集的
 * BMFont MSDF 图集（public/fonts/noto-sans-sc-{regular,bold}.json
 * + .webp），运行时把该字体族以 FontInfo JSON 的形式注入每个面板
 * 的根元素 fontFamilies，覆盖 @font-face 自动装配的 TTF 条目。
 * 面板样式里 font-family: noto-sans-sc 的元素（中文文案所在类）
 * 随即改用这份图集渲染；英文元素仍用套件自带的 Inter，不受影响。
 *
 * 图集再生成方法见 scripts/build-cjk-font.md（数据文件新增文案后
 * 需重跑，否则新字仍是方块）。
 */

import { createSystem, UIKitMLAsset } from '@iwsdk/core';
import type { Component } from '@pmndrs/uikit';

const FONT_FAMILY = 'noto-sans-sc';
const REGULAR_URL = `${import.meta.env.BASE_URL}fonts/noto-sans-sc-regular.json`;
const BOLD_URL = `${import.meta.env.BASE_URL}fonts/noto-sans-sc-bold.json`;

/** 场景中全部 UIKitML 面板（public/scenes/main.iwsdk.scene.json 的节点 id）。 */
const PANEL_IDS = [
  'welcome-panel',
  'gate-panel',
  'bench-panel',
  'serpent-panel',
  'starlight-panel',
  'interaction-hint-panel',
  'music-panel',
  'bench-notes-panel',
  'comedy-screen-panel',
  'comedy-name-panel',
  'comedy-catalog-panel',
] as const;

type FontFamiliesRecord = Record<string, unknown>;

/** 取根元素当前已装配的 fontFamilies（保留套件自带的 inter 等条目）。 */
function currentFontFamilies(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  root: Component<any>,
): FontFamiliesRecord | undefined {
  const signal = (
    root as unknown as {
      fontFamilies?: { peek?: () => FontFamiliesRecord | undefined };
    }
  ).fontFamilies;
  return signal?.peek?.();
}

export class CjkFontSystem extends createSystem({}) {
  private readonly pending = new Set<string>(PANEL_IDS);

  init(): void {
    this.applyPending();
  }

  update(): void {
    // 面板是场景资产、异步装配完成；未就绪的留待下一帧重试，
    // 全部注入后 pending 清空、本函数即为空转。
    if (this.pending.size > 0) {
      this.applyPending();
    }
  }

  private applyPending(): void {
    for (const id of [...this.pending]) {
      const panel = this.world.getSceneObject<UIKitMLAsset>(id);
      const root = panel?.document?.rootElement;
      if (panel == null || root == null) {
        continue;
      }
      const existing = currentFontFamilies(root) ?? {};
      root.setProperties({
        fontFamilies: {
          ...existing,
          [FONT_FAMILY]: {
            normal: REGULAR_URL,
            bold: BOLD_URL,
            '400': REGULAR_URL,
            '700': BOLD_URL,
          },
        },
      });
      this.pending.delete(id);
    }
  }
}
