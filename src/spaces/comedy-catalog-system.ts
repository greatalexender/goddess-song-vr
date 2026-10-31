/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import {
  createSystem,
  Mesh,
  MeshStandardMaterial,
  UIKitMLAsset,
} from '@iwsdk/core';
import type { ComedyScreenHandle } from './comedy-catalog.js';
import {
  loadComedyCatalog,
  presentEpisode,
} from './comedy-catalog.js';
import type { ComedyCatalog } from './comedy-catalog.js';

/**
 * 每日一笑馆 · 选集系统（v1）。
 *
 * 做的事只有三件：载入剧集目录（public/comedy-catalog.json，
 * 数据层见 comedy-catalog.ts）、把目录按页填进选集面板的 6 个
 * 固定槽位、点选后经 presentEpisode() 把标题卡交给银幕（写
 * comedy-screen 面板的三个文本元素 + 提亮银幕网格的微光）。
 *
 * 纪律：
 * - 播放源只经 comedy-catalog.ts 的 presentEpisode 一个口：
 *   将来公开托管后在那里挂视频纹理，本系统不用改。
 * - 零新增点光源：银幕的「亮」是它自己材质的 emissive 提亮，
 *   不照物；全场点光源仍守恒 4 盏。
 * - 不碰音频钩子 applySpaceLampAudioLevel（签名冻结，与本馆
 *   无关）；不加音频/视频资产。
 * - 本馆只在自由回访可达（回访小点在 arc-system.ts），馆内
 *   面板常驻即可，不另设显隐门控——与音乐亭面板同例。
 */

/** 选集面板每页槽位数（与 comedy-catalog.uikitml 的 ep-N 对齐）。 */
const PAGE_SIZE = 6;

type PanelElement = ReturnType<UIKitMLAsset['getElementById']>;

export class ComedyCatalogSystem extends createSystem({}) {
  private catalog: ComedyCatalog = { version: 0, episodes: [] };
  private page = 0;

  private readonly slotButtons: PanelElement[] = [];
  private readonly slotLabels: PanelElement[] = [];
  private pageLine: PanelElement | undefined;
  private prevButton: PanelElement | undefined;
  private nextButton: PanelElement | undefined;

  private screenTitle: PanelElement | undefined;
  private screenSub: PanelElement | undefined;
  private screenNote: PanelElement | undefined;
  private screenMaterial: MeshStandardMaterial | undefined;
  private screenBaseGlow = 0;

  /** presentEpisode 的银幕把手：写标题卡元素 + 调银幕微光。 */
  private readonly screenHandle: ComedyScreenHandle = {
    showTitleCard: (title, sub, note) => {
      this.screenTitle?.setProperties({ text: title });
      this.screenSub?.setProperties({ text: sub });
      this.screenNote?.setProperties({ text: note });
    },
    setGlow: (level) => {
      if (this.screenMaterial != null) {
        this.screenMaterial.emissiveIntensity = this.screenBaseGlow * level;
      }
    },
  };

  init(): void {
    // 银幕网格：comedy-theater 资产内名为 comedy-screen 的网格，
    // 记下它的材质与静息微光（点选后按增益提亮，见 screenHandle）。
    const theater = this.world.getSceneObject('comedy-theater');
    if (theater != null) {
      const screenMesh = theater.getObjectByName('comedy-screen');
      if (screenMesh instanceof Mesh) {
        const material = Array.isArray(screenMesh.material)
          ? screenMesh.material[0]
          : screenMesh.material;
        if (material instanceof MeshStandardMaterial) {
          this.screenMaterial = material;
          this.screenBaseGlow = material.emissiveIntensity;
        }
      }
    }

    // 银幕标题卡面板的三个文本元素。
    const screenPanel =
      this.world.getSceneObject<UIKitMLAsset>('comedy-screen-panel');
    if (screenPanel != null) {
      this.screenTitle = screenPanel.getElementById('screen-title');
      this.screenSub = screenPanel.getElementById('screen-sub');
      this.screenNote = screenPanel.getElementById('screen-note');
    }

    // 选集面板：槽位 + 翻页，接好点选再等目录载入。
    const catalogPanel =
      this.world.getSceneObject<UIKitMLAsset>('comedy-catalog-panel');
    if (catalogPanel != null) {
      this.setupCatalogPanel(catalogPanel);
    }
    this.renderPage();
    void loadComedyCatalog().then((catalog) => {
      this.catalog = catalog;
      this.page = 0;
      this.renderPage();
    });
  }

  private setupCatalogPanel(panel: UIKitMLAsset): void {
    for (let i = 1; i <= PAGE_SIZE; i++) {
      const button = panel.getElementById(`ep-${i}`);
      const label = panel.getElementById(`ep-label-${i}`);
      this.slotButtons.push(button);
      this.slotLabels.push(label);
      if (button == null) continue;
      const slotIndex = i - 1;
      const onClick = () => {
        const entry =
          this.catalog.episodes[this.page * PAGE_SIZE + slotIndex];
        if (entry != null) presentEpisode(entry, this.screenHandle);
      };
      button.addEventListener('click', onClick);
      this.cleanupFuncs.push(() =>
        button.removeEventListener('click', onClick),
      );
    }
    this.pageLine = panel.getElementById('catalog-page');
    this.prevButton = panel.getElementById('page-prev');
    this.nextButton = panel.getElementById('page-next');
    if (this.prevButton != null) {
      const onPrev = () => {
        if (this.page > 0) {
          this.page--;
          this.renderPage();
        }
      };
      this.prevButton.addEventListener('click', onPrev);
      this.cleanupFuncs.push(() =>
        this.prevButton?.removeEventListener('click', onPrev),
      );
    }
    if (this.nextButton != null) {
      const onNext = () => {
        if (this.page < this.pageCount() - 1) {
          this.page++;
          this.renderPage();
        }
      };
      this.nextButton.addEventListener('click', onNext);
      this.cleanupFuncs.push(() =>
        this.nextButton?.removeEventListener('click', onNext),
      );
    }
  }

  private pageCount(): number {
    return Math.max(1, Math.ceil(this.catalog.episodes.length / PAGE_SIZE));
  }

  /** 把当前页的条目填进槽位；空槽隐藏，翻页钮按边界显隐。 */
  private renderPage(): void {
    const episodes = this.catalog.episodes;
    for (let i = 0; i < PAGE_SIZE; i++) {
      const entry = episodes[this.page * PAGE_SIZE + i];
      const button = this.slotButtons[i];
      const label = this.slotLabels[i];
      if (button == null) continue;
      if (entry == null) {
        button.setProperties({ display: 'none' });
      } else {
        button.setProperties({ display: 'flex' });
        label?.setProperties({
          text: `${entry.episode} · ${entry.title}`,
        });
      }
    }
    if (this.pageLine != null) {
      this.pageLine.setProperties({
        text:
          episodes.length === 0
            ? '目录还没有送到 · The catalog has not arrived yet'
            : `第 ${this.page + 1} / ${this.pageCount()} 页 · Page ${this.page + 1} of ${this.pageCount()}`,
      });
    }
    this.prevButton?.setProperties({
      display: this.page > 0 ? 'flex' : 'none',
    });
    this.nextButton?.setProperties({
      display: this.page < this.pageCount() - 1 ? 'flex' : 'none',
    });
  }
}
