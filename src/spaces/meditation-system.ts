/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { createSystem, Mesh, MeshBasicMaterial } from '@iwsdk/core';
import type { Object3D } from '@iwsdk/core';

/**
 * 冥想地（空间 7 · Sri Vidya）的光轮收束动画。
 *
 * 动画语义：Sri Chakra 的线条几何随「收束量」level（0→1）由外向
 * 内逐层收拢——外框最先隐去，四层三角形依次缩小、变淡，最终只剩
 * 中心 bindu 一点光，而后归于静止。这正是五段弧在光轮上的投影：
 * 五段歌程走完，光归于一点。
 *
 * 驱动方式沿用现有音频钩子的模式（与 applySpaceLampAudioLevel
 * 同一套「增益」语义）：本系统只消费一个 0–1 的 level，不关心它
 * 从哪来。当前没有真实音频（梵语校对红线未过，不加音频资产），
 * level 由一条 120 秒周期的测试正弦供给——前半程收束、后半程
 * 舒张，循环往复，与第四阶段段落灯的正弦呼吸同法。音频阶段接入
 * 改编版后，把 level 的来源换成歌曲包络（五段弧进程即 level 的
 * 0→1），本系统的分层窗口与签名都不用改；spaces.ts 已为空间 7
 * 在 applySpaceLampAudioLevel 的语义里预留位置（ArcSystem 无 7 号
 * 灯绑定，该调用当前是安全空转，冥想地不借段落灯通道驱动）。
 *
 * 性能：init 时把各层组的材质与基准 opacity 收进预分配数组，
 * update 内零分配；动画只有 scale / opacity 写入。
 */

/** 收束测试正弦的周期（秒）：60 秒收束 + 60 秒舒张。 */
const CONVERGE_PERIOD_SECONDS = 120;

/** 四层三角形的收束窗口（level 区间，由外向内依次启动）。 */
const TIER_WINDOWS: ReadonlyArray<readonly [number, number]> = [
  [0.08, 0.5],
  [0.28, 0.66],
  [0.48, 0.82],
  [0.66, 0.96],
];

/** 外框的隐去窗口：最早开始，level 到 0.3 时只剩残影。 */
const FRAME_WINDOW: readonly [number, number] = [0, 0.3];

/** bindu 的生长窗口：收束后半程亮起、长大。 */
const BINDU_WINDOW: readonly [number, number] = [0.6, 1];

interface FadeBinding {
  material: MeshBasicMaterial;
  base: number;
}

interface AnimGroup {
  object: Object3D;
  materials: FadeBinding[];
}

/** level 在 [start, end] 内的平滑进度（smoothstep），窗外钳制。 */
function windowProgress(level: number, start: number, end: number): number {
  const t = Math.min(Math.max((level - start) / (end - start), 0), 1);
  return t * t * (3 - 2 * t);
}

/** 收集一个组子树里全部 MeshBasicMaterial 及各自基准 opacity。 */
function collectBasicMaterials(root: Object3D, out: FadeBinding[]): void {
  const seen = new Set<MeshBasicMaterial>();
  root.traverse((child) => {
    if (!(child instanceof Mesh)) return;
    const materials = Array.isArray(child.material)
      ? child.material
      : [child.material];
    for (const material of materials) {
      if (material instanceof MeshBasicMaterial && !seen.has(material)) {
        seen.add(material);
        out.push({ material, base: material.opacity });
      }
    }
  });
}

export class MeditationSystem extends createSystem({}) {
  private frameGroup: AnimGroup | undefined;
  private readonly tierGroups: AnimGroup[] = [];
  private binduGroup: Object3D | undefined;

  init(): void {
    const seat = this.world.getSceneObject('meditation-seat');
    const chakra = seat?.getObjectByName('sri-chakra');
    if (chakra == null) return;

    const frame = chakra.getObjectByName('chakra-frame');
    if (frame != null) {
      const materials: FadeBinding[] = [];
      collectBasicMaterials(frame, materials);
      this.frameGroup = { object: frame, materials };
    }
    for (let i = 0; i < TIER_WINDOWS.length; i++) {
      const tier = chakra.getObjectByName(`chakra-tier-${i}`);
      if (tier == null) continue;
      const materials: FadeBinding[] = [];
      collectBasicMaterials(tier, materials);
      this.tierGroups.push({ object: tier, materials });
    }
    this.binduGroup = chakra.getObjectByName('chakra-bindu');
  }

  update(_delta: number, time: number): void {
    if (this.frameGroup == null && this.tierGroups.length === 0) return;

    // 测试正弦供源：level 0→1→0，音频阶段换歌曲包络（见文件头）。
    const level =
      0.5 -
      0.5 * Math.cos((time / CONVERGE_PERIOD_SECONDS) * Math.PI * 2);

    // 外框：只隐去，不缩放——框是「地方」，先退场。
    if (this.frameGroup != null) {
      const fade =
        1 - 0.97 * windowProgress(level, FRAME_WINDOW[0], FRAME_WINDOW[1]);
      for (const binding of this.frameGroup.materials) {
        binding.material.opacity = binding.base * fade;
      }
    }

    // 四层三角：逐层向轮心收拢（scale 趋 0.1）并变淡至残影。
    for (let i = 0; i < this.tierGroups.length; i++) {
      const group = this.tierGroups[i];
      const progress = windowProgress(
        level,
        TIER_WINDOWS[i][0],
        TIER_WINDOWS[i][1],
      );
      const scale = 1 - 0.9 * progress;
      group.object.scale.setScalar(scale);
      const fade = 1 - 0.96 * progress;
      for (const binding of group.materials) {
        binding.material.opacity = binding.base * fade;
      }
    }

    // bindu：不收束，只在后半程长大——收束的终点是它长成唯一的光。
    if (this.binduGroup != null) {
      const growth = windowProgress(level, BINDU_WINDOW[0], BINDU_WINDOW[1]);
      this.binduGroup.scale.setScalar(1 + 1.6 * growth);
    }
  }
}
