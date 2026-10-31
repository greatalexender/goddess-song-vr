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
  Object3D,
  Quaternion,
  UIKitMLAsset,
  Vector3,
} from '@iwsdk/core';
import { ArcDirector } from './arc-components.js';
import {
  addBenchNote,
  BENCH_NOTE_PRESETS,
  getAllBenchNotes,
  installBenchNotesApi,
  onBenchNotesChanged,
} from './bench-notes.js';

/**
 * 长椅留言层 · 访客侧系统（v1）。
 *
 * 真曦的长椅是数字城「城门口留言版」落在园子里的实体：人看见
 * 的只是一张安静的长椅；椅面之下悬着一点微光，注视它约 1.2 秒
 * （或在注视时捏合，与落点标记同一套确认语义）才展开留言面板，
 * 读历来的字条、从 6 句预置短句里点选一条留下。同一份数据由
 * bench-notes.ts 同时暴露为机器可读层（bench-notes.json +
 * window.__EDEN_BENCH_NOTES__），那是留给智能体的门。
 *
 * 纪律：
 * - 只在自由回访模式（ArcDirector.freeRevisit）下存在：微光标记
 *   与面板五段弧进行中一律隐藏，不打扰段落体验；换位淡出/淡入
 *   期间（transitionPhase ≠ 0）不接受确认。
 * - 零新增点光源：标记只有 emissive，面板是 UIKitML，都不发光
 *   照物；全场点光源仍守恒 4 盏。
 * - 不碰音频钩子 applySpaceLampAudioLevel（签名冻结，与本层
 *   无关）；不加音频资产。
 * - 逐帧逻辑零分配：向量/四元数都是类字段复用；交互判定节流
 *   到约 100 ms 一次，与 ArcSystem 同法。
 */

/** 面板里固定字条槽位数（与 bench-notes.uikitml 的 note-N 对齐）。 */
const NOTE_SLOT_COUNT = 8;
/** 注视微光标记的停留确认时长（秒），与落点标记同一数值。 */
const GAZE_DWELL_SECONDS = 1.2;
/** 交互采样间隔（秒）。 */
const SAMPLE_INTERVAL_SECONDS = 0.1;
/** 微光标记可被注视确认的最远距离（米）：再远只是风景，不是门。 */
const MARKER_MAX_DISTANCE = 7;

interface EmissiveBinding {
  material: MeshStandardMaterial;
  base: number;
}

export class BenchNotesSystem extends createSystem({
  directors: { required: [ArcDirector] },
}) {
  private markerObject: Object3D | undefined;
  private panel: UIKitMLAsset | undefined;
  private readonly markerMaterials: EmissiveBinding[] = [];
  private readonly markerWorldPosition = new Vector3();
  private readonly noteSlots: Array<ReturnType<UIKitMLAsset['getElementById']>> =
    [];
  private moreLine: ReturnType<UIKitMLAsset['getElementById']> | undefined;

  private layerActive = false;
  private panelOpen = false;
  private gazeSeconds = 0;
  private sampleAccumulator = 0;

  // 逐帧复用的临时量（update 内禁止分配）。
  private readonly tempVecA = new Vector3();
  private readonly tempVecB = new Vector3();
  private readonly tempQuat = new Quaternion();

  init(): void {
    // 椅下微光标记：初始隐藏，进自由回访才显形。
    const marker = this.world.getSceneObject('bench-note-marker');
    if (marker != null) {
      this.markerObject = marker;
      marker.getWorldPosition(this.markerWorldPosition);
      collectEmissiveMaterials(marker, this.markerMaterials);
      marker.visible = false;
    }

    // 留言面板：初始隐藏，展开时才填内容。
    const panel = this.world.getSceneObject<UIKitMLAsset>('bench-notes-panel');
    if (panel != null) {
      this.panel = panel;
      panel.visible = false;
      this.setupPanel(panel);
    }

    // 机器可读层：把同一份字条数据挂上 window（智能体的门），
    // 并在字条增减时刷新面板（若正开着）。
    this.cleanupFuncs.push(
      installBenchNotesApi(),
      onBenchNotesChanged(() => this.renderNotes()),
    );
    this.renderNotes();
  }

  private setupPanel(panel: UIKitMLAsset): void {
    for (let i = 1; i <= NOTE_SLOT_COUNT; i++) {
      this.noteSlots.push(panel.getElementById(`note-${i}`));
    }
    this.moreLine = panel.getElementById('notes-more');

    // 预置短句：文案单一事实来源在 bench-notes.ts，这里只写进
    // 按钮标签，并把点选接到 addBenchNote（存本地 + 通知刷新）。
    BENCH_NOTE_PRESETS.forEach((preset, index) => {
      const label = panel.getElementById(`preset-label-${index + 1}`);
      label?.setProperties({ text: preset.text });
      const button = panel.getElementById(`preset-${index + 1}`);
      if (button == null) return;
      const onClick = () => {
        addBenchNote(preset.text, preset.author);
      };
      button.addEventListener('click', onClick);
      this.cleanupFuncs.push(() =>
        button.removeEventListener('click', onClick),
      );
    });

    const closeButton = panel.getElementById('close-button');
    if (closeButton != null) {
      const onClose = () => this.setPanelOpen(false);
      closeButton.addEventListener('click', onClose);
      this.cleanupFuncs.push(() =>
        closeButton.removeEventListener('click', onClose),
      );
    }
  }

  /** 把合并后的字条填进固定槽位；放不下的在末行报数。 */
  private renderNotes(): void {
    if (this.panel == null) return;
    const notes = getAllBenchNotes();
    for (let i = 0; i < NOTE_SLOT_COUNT; i++) {
      const slot = this.noteSlots[i];
      if (slot == null) continue;
      const note = notes[i];
      if (note == null) {
        slot.setProperties({ display: 'none' });
      } else {
        slot.setProperties({
          display: 'flex',
          text: `${note.text} —— ${note.author}`,
        });
      }
    }
    if (this.moreLine != null) {
      const overflow = notes.length - NOTE_SLOT_COUNT;
      if (overflow > 0) {
        this.moreLine.setProperties({
          display: 'flex',
          text: `还有 ${overflow} 张字条压在椅子下 · ${overflow} more notes rest beneath the bench`,
        });
      } else {
        this.moreLine.setProperties({ display: 'none' });
      }
    }
  }

  private setPanelOpen(open: boolean): void {
    if (this.panel == null) return;
    this.panelOpen = open;
    this.panel.visible = open;
    if (open) this.renderNotes();
  }

  update(delta: number, time: number): void {
    // 微光呼吸：只在显形时写材质，隐藏时连写都不写。
    if (this.markerObject != null && this.markerObject.visible) {
      const pulse = 1.15 + 0.3 * Math.sin(time * 2.2);
      for (const binding of this.markerMaterials) {
        binding.material.emissiveIntensity = binding.base * pulse;
      }
    }

    this.sampleAccumulator += delta;
    if (this.sampleAccumulator < SAMPLE_INTERVAL_SECONDS) return;
    const sampleDelta = this.sampleAccumulator;
    this.sampleAccumulator = 0;
    this.sampleInteractions(sampleDelta);
  }

  /** 约 100 ms 一次：同步显隐、注视停留、捏合确认。 */
  private sampleInteractions(dt: number): void {
    // 读段落状态：自由回访与换位相位都以 ArcDirector 为准。
    let freeRevisit = false;
    let inTransition = false;
    for (const entity of this.queries.directors.entities) {
      freeRevisit =
        entity.getValue(ArcDirector, 'freeRevisit') ?? false;
      inTransition =
        (entity.getValue(ArcDirector, 'transitionPhase') ?? 0) !== 0;
      break;
    }

    // 留言层只活在自由回访里：弧一开始（或回访退出）立即收起。
    if (freeRevisit !== this.layerActive) {
      this.layerActive = freeRevisit;
      if (this.markerObject != null) {
        this.markerObject.visible = freeRevisit;
      }
      if (!freeRevisit && this.panelOpen) this.setPanelOpen(false);
      this.gazeSeconds = 0;
    }
    if (!this.layerActive || this.markerObject == null) return;
    if (inTransition) {
      this.gazeSeconds = 0;
      return;
    }

    const gazed = this.isMarkerGazed();

    // 捏合确认：注视对准标记时任一手 select 起始即切换面板。
    const selectStart =
      this.input.xr.getSelectState('left').start ||
      this.input.xr.getSelectState('right').start;
    if (selectStart && gazed) {
      this.setPanelOpen(!this.panelOpen);
      this.gazeSeconds = 0;
      return;
    }

    // 注视停留确认：对准约 1.2 秒切换面板（开着时再注视可收起）。
    if (gazed) {
      this.gazeSeconds += dt;
      if (this.gazeSeconds >= GAZE_DWELL_SECONDS) {
        this.setPanelOpen(!this.panelOpen);
        this.gazeSeconds = 0;
      }
    } else {
      this.gazeSeconds = 0;
    }
  }

  /** 头部注视射线是否对准椅下微光（垂距容差随距离放宽，同 ArcSystem）。 */
  private isMarkerGazed(): boolean {
    this.player.head.getWorldPosition(this.tempVecA);
    this.player.head.getWorldQuaternion(this.tempQuat);
    this.tempVecB.set(0, 0, -1).applyQuaternion(this.tempQuat);
    this.tempVecA.subVectors(this.markerWorldPosition, this.tempVecA);
    const along = this.tempVecA.dot(this.tempVecB);
    if (along < 0.4 || along > MARKER_MAX_DISTANCE) return false;
    this.tempVecA.addScaledVector(this.tempVecB, -along);
    const miss = this.tempVecA.length();
    const tolerance = Math.max(0.2, along * 0.05);
    return miss <= tolerance;
  }
}

/** 收集一个对象子树里全部 emissive 材质及其基准强度（同 ArcSystem）。 */
function collectEmissiveMaterials(
  root: Object3D,
  out: EmissiveBinding[],
): void {
  const seen = new Set<MeshStandardMaterial>();
  root.traverse((child) => {
    if (!(child instanceof Mesh)) return;
    const materials = Array.isArray(child.material)
      ? child.material
      : [child.material];
    for (const material of materials) {
      if (material instanceof MeshStandardMaterial && !seen.has(material)) {
        seen.add(material);
        out.push({ material, base: material.emissiveIntensity });
      }
    }
  });
}
