/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { createSystem, UIKitMLAsset, VisibilityState } from '@iwsdk/core';
import { primeSongAudio } from './audio/song-bus.js';

/**
 * 欢迎面板：Enter XR / Exit 按钮 + 第二批改版（2026-11-14）的
 * 园门礼仪：
 *
 * 双保险第一重：点 Enter XR 的那一下（真实用户手势）先经
 * primeSongAudio() 激发歌曲——AudioContext 在手势内创建/resume、
 * 缓冲开始解码，进亭前就静音待命，不等进亭才准备。
 *
 * 一次性小提示：首次访客把射线/注视停在 Enter XR 上（发光由
 * welcome.uikitml 的 :hover 承担）即浮现提示行——手势用户看
 * 「捏一下进入」，检测到手柄（gamepad）时换「按一下进入」；
 * 成功进入 XR 后消失并写入 localStorage，同访客不再出现。
 *
 * 失败不沉默：launchXR() 返回 void、无从 catch，故点击前先
 * isSessionSupported 预检，点击后 3 s 看门狗确认是否真进入；
 * 不支持或没进去都亮明 plain-language 原因 + 下一步（xr-error
 * 行），xrEnabled 为假时同样亮明，不再只是把按钮藏起来。
 */

const HINT_SEEN_KEY = 'eden.enterHintSeen.v1';
const ENTER_WATCHDOG_MS = 3000;

export class PanelSystem extends createSystem({}) {
  private hintSeen = false;
  private hintShown = false;
  private hintVariant: 'pinch' | 'trigger' | undefined;
  private inXR = false;
  private watchdog: number | undefined;
  private padPollAccumulator = 0;

  private enterHint: ReturnType<UIKitMLAsset['getElementById']> | undefined;
  private enterHintText:
    | ReturnType<UIKitMLAsset['getElementById']>
    | undefined;
  private xrError: ReturnType<UIKitMLAsset['getElementById']> | undefined;
  private xrErrorZh: ReturnType<UIKitMLAsset['getElementById']> | undefined;
  private xrErrorEn: ReturnType<UIKitMLAsset['getElementById']> | undefined;

  init(): void {
    const panel = this.world.getSceneObject<UIKitMLAsset>('welcome-panel');
    const xrButton = panel?.getElementById('xr-button');
    const exitButton = panel?.getElementById('exit-button');
    if (panel == null || xrButton == null || exitButton == null) {
      return;
    }
    this.enterHint = panel.getElementById('enter-hint');
    this.enterHintText = panel.getElementById('enter-hint-text');
    this.xrError = panel.getElementById('xr-error');
    this.xrErrorZh = panel.getElementById('xr-error-zh');
    this.xrErrorEn = panel.getElementById('xr-error-en');
    try {
      this.hintSeen = window.localStorage.getItem(HINT_SEEN_KEY) === '1';
    } catch {
      this.hintSeen = false;
    }

    if (!this.world.xrEnabled) {
      xrButton.setProperties({ display: 'none' });
      exitButton.setProperties({ display: 'none' });
      this.showError(
        '此设备不支持进入',
        "THIS PAGE CAN'T ENTER VR HERE — PLEASE OPEN IT IN YOUR HEADSET'S BROWSER",
      );
      return;
    }

    const launchXR = () => {
      // 第一重保险：在真实点击手势内激发歌曲（建 context、
      // resume、预热解码），与 launchXR 本身互不依赖。
      primeSongAudio();
      this.hideError();
      const nav = navigator as Navigator & {
        xr?: { isSessionSupported?: (mode: string) => Promise<boolean> };
      };
      if (nav.xr?.isSessionSupported) {
        nav.xr
          .isSessionSupported('immersive-vr')
          .then((supported) => {
            if (!supported && !this.inXR) {
              this.showError(
                '此设备不支持进入',
                'THIS HEADSET OR BROWSER DOES NOT SUPPORT VR — TRY THE QUEST BROWSER',
              );
            }
          })
          .catch(() => {});
      }
      this.world.launchXR();
      // 看门狗：3 秒后仍在 2D，就把失败摆到明面上。
      if (this.watchdog != null) window.clearTimeout(this.watchdog);
      this.watchdog = window.setTimeout(() => {
        if (!this.inXR) {
          this.showError(
            '进入失败，请戴好头显再按一次',
            'ENTRY DID NOT START — PUT THE HEADSET ON AND TAP ENTER XR AGAIN',
          );
        }
      }, ENTER_WATCHDOG_MS);
    };
    const exitXR = () => this.world.exitXR();
    xrButton.addEventListener('click', launchXR);
    exitButton.addEventListener('click', exitXR);

    // 悬停（注视/射线停在按钮上，按钮 :hover 发光）→ 浮现提示。
    const onHover = () => {
      if (!this.hintSeen && !this.inXR) this.showHint();
    };
    xrButton.addEventListener('pointerenter', onHover);

    this.cleanupFuncs.push(
      () => xrButton.removeEventListener('click', launchXR),
      () => exitButton.removeEventListener('click', exitXR),
      () => xrButton.removeEventListener('pointerenter', onHover),
      this.world.visibilityState.subscribe((visibilityState) => {
        const is2D = visibilityState === VisibilityState.NonImmersive;
        this.inXR = !is2D;
        xrButton.setProperties({ display: is2D ? 'flex' : 'none' });
        exitButton.setProperties({ display: is2D ? 'none' : 'flex' });
        if (!is2D) {
          // 真进去了：提示完成使命，记住这位访客、撤下看门狗。
          if (this.watchdog != null) {
            window.clearTimeout(this.watchdog);
            this.watchdog = undefined;
          }
          this.hideError();
          this.hideHint();
          if (!this.hintSeen) {
            this.hintSeen = true;
            try {
              window.localStorage.setItem(HINT_SEEN_KEY, '1');
            } catch {
              // 记不住也不拦路：下次再显示一次而已。
            }
          }
        }
      }),
    );
  }

  private showHint(): void {
    if (this.enterHint == null) return;
    this.enterHint.setProperties({ display: 'flex' });
    this.hintShown = true;
    this.refreshHintVariant(true);
  }

  private hideHint(): void {
    this.enterHint?.setProperties({ display: 'none' });
    this.hintShown = false;
  }

  private showError(zh: string, en: string): void {
    if (this.xrError == null) return;
    this.xrErrorZh?.setProperties({ text: zh });
    this.xrErrorEn?.setProperties({ text: en });
    this.xrError.setProperties({ display: 'flex' });
  }

  private hideError(): void {
    this.xrError?.setProperties({ display: 'none' });
  }

  /** 提示文案按输入设备切换：有手柄 → 扳机版；否则捏合版。 */
  private refreshHintVariant(force = false): void {
    if (this.enterHintText == null) return;
    let hasPad = false;
    try {
      const pads = navigator.getGamepads?.() ?? [];
      for (const pad of pads) {
        if (pad != null && pad.buttons.length > 0) {
          hasPad = true;
          break;
        }
      }
    } catch {
      hasPad = false;
    }
    const variant = hasPad ? 'trigger' : 'pinch';
    if (!force && variant === this.hintVariant) return;
    this.hintVariant = variant;
    this.enterHintText.setProperties({
      text:
        variant === 'trigger'
          ? '按一下进入 · PULL THE TRIGGER TO ENTER'
          : '捏一下进入 · PINCH TO ENTER',
    });
  }

  update(delta: number): void {
    // 提示浮现期间轮询输入设备（戴着手柄靠近时文案跟上）。
    if (!this.hintShown) return;
    this.padPollAccumulator += delta;
    if (this.padPollAccumulator >= 0.5) {
      this.padPollAccumulator = 0;
      this.refreshHintVariant();
    }
  }
}
