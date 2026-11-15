/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import {
  createSystem,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  Object3D,
  PlaneGeometry,
  Pressed,
  Quaternion,
  TextureLoader,
  UIKitMLAsset,
  Vector3,
} from '@iwsdk/core';
import { ArcDirector } from './arc-components.js';
import { PavilionExitSign } from './pavilion-components.js';
import { requestArcTravel } from './arc-system.js';
import {
  getSongLampLevel,
  getSongStatus,
  requestSongPlay,
  requestSongStop,
  type SongStatus,
} from '../audio/song-bus.js';

/**
 * 歌亭改版（2026-11-14，施工单定版）——只管歌亭这一条线：
 *
 * 进（新导航）：身处入口（第 0 段）时，注视歌亭本体——亭身材质
 * 随注视进度泛起金色闪光（反馈落在眼睛已看着的地方），满约
 * 1.1 s 直接进入（经 requestArcTravel 复用 ArcSystem 的淡入
 * 淡出换位）；手柄扳机/捏合直瞄亭身同样即时进入。本线废除
 * 地面光圈中介与大手势必经（旧标记/手势路径原样保留在
 * ArcSystem，不归本系统管）。
 *
 * 歌：进入第 1 段自动起播（SongSystem），离开即停；段落灯的
 * 音频电平驱动在 ArcSystem + SongSystem，本系统只发请求。
 *
 * 出：歌亭观众点前方固定一面退出标志（pavilion-exit-panel，
 * 只在第 1 段显形），点按（Pressed）或注视满 1 s 即回中央。
 *
 * 活画（只动光与水，守「有点」分寸）：轻纱摆动（亭的签名
 * 动作）、水面微光/微漾、薄雾缓流、晨光束轻移、莲心闪点。
 *
 * B 案（画像模式）：第 1 段在观众眼前大幅展开三界画像作听歌
 * 主视觉。第二批改版（2026-11-14）启用为送审版默认：语言规则
 * ——界面中文用中文 v2 像、英文用英文像，送审构建默认英文
 * （按 navigator.language 判定，非中文一律英文像）。画像轻
 * 动态：亮度随歌曲真实电平呼吸（无电平时走慢速正弦），其余
 * 静态（光轮缓转需分层素材，留待后续）。
 *
 * 第三批改版（2026-11-14 真机复测后，Solomon 亲定）：「进入
 * 亭子后不要看到亭子，就是背景莲花池像和中间正中的女神像」。
 * 第二批的画像面立在亭体内部（距亭轴 1.55 m，落在柱环/纱环
 * 之内、与穹顶相交），真机上被轻纱与亭体遮挡（Vision Pro 只
 * 见下半截、Quest 全不可见）。本批改法：第 1 段隐藏亭体外壳
 * （柱、穹顶、轻纱、座、琴、基座等全部网格子树，唯段落灯组
 * 保留——灯光呼吸是背景的一部分），画像移到观众正前方视轴
 * 正中（2.8 m、1.6×2.4 m、定心眼高 1.5 m），其后 6.2 m 处立
 * 大幅莲池背景像（Solomon 亲发晨光莲池图，图中亭心经横向
 * 偏移对正视轴、由画像覆住）；池面薄雾与晨光斜束在第 1 段
 * 一并隐藏（避免透明薄片切过画像/背景面），水面与莲保留。
 * 园外（第 0 段）亭体外观与注视进入完全不变。
 */

export const PAVILION_PORTRAIT_MODE = true;

const STAGE_ENTRANCE = 0;
const STAGE_LOTUS = 1;

/** 歌亭本体的注视靶心（亭心 + 眼高），世界坐标。 */
const PAVILION_TARGET = new Vector3(-7, 1.6, -6.5);

/**
 * 第 1 段观众点（与 ArcSystem 的 STAGE_VIEWS[1] 一致）与视轴：
 * 自观众点指向亭心。画像/背景像的摆位全部由这条轴推导。
 */
const AUDIENCE_X = -4.55;
const AUDIENCE_Z = -3.15;
const VIEW_AXIS = new Vector3(
  PAVILION_TARGET.x - AUDIENCE_X,
  0,
  PAVILION_TARGET.z - AUDIENCE_Z,
).normalize();
/** 观众右手方向（视轴顺时针 90°），用于背景像的横向对位。 */
const VIEW_RIGHT = new Vector3(-VIEW_AXIS.z, 0, VIEW_AXIS.x);

const PORTRAIT_DISTANCE = 2.8;
const PORTRAIT_WIDTH = 1.6;
const PORTRAIT_HEIGHT = 2.4;
const PORTRAIT_CENTER_Y = 1.5;
const BACKDROP_DISTANCE = 6.2;
const BACKDROP_WIDTH = 8.0;
const BACKDROP_HEIGHT = 4.5;
const BACKDROP_CENTER_Y = 1.7;
/**
 * 背景图中的亭子位于画面宽度约 58% 处：整面左移 0.6 m，让图中
 * 亭心落到视轴上、正好被居中画像覆住。
 */
const BACKDROP_AXIS_SHIFT = 0.6;
const ENTER_GAZE_DWELL_SECONDS = 1.1;
const ENTER_MAX_ANGLE_COS = Math.cos((15 * Math.PI) / 180);
const EXIT_GAZE_DWELL_SECONDS = 1.0;
const EXIT_MAX_ANGLE_COS = Math.cos((12 * Math.PI) / 180);
const FLASH_GOLD = 0xffc46b;
const LAMP_BULB_EMISSIVE = 0xffb84d;

interface FlashBinding {
  material: MeshStandardMaterial;
  baseEmissiveHex: number;
  baseIntensity: number;
}

interface MistBinding {
  object: Object3D;
  material: MeshBasicMaterial;
  baseX: number;
  baseOpacity: number;
}

/** 子树里是否有网格（init 期一次性分拣用）。 */
function subtreeHasMesh(root: Object3D): boolean {
  let found = false;
  root.traverse((child) => {
    if (child instanceof Mesh) found = true;
  });
  return found;
}

/** 子树里是否有段落灯灯球（按 emissive 色认领，与闪光排除同口径）。 */
function subtreeHasLampBulb(root: Object3D): boolean {
  let found = false;
  root.traverse((child) => {
    if (found || !(child instanceof Mesh)) return;
    const materials = Array.isArray(child.material)
      ? child.material
      : [child.material];
    for (const material of materials) {
      if (
        material instanceof MeshStandardMaterial &&
        material.emissive.getHex() === LAMP_BULB_EMISSIVE
      ) {
        found = true;
      }
    }
  });
  return found;
}

export class PavilionSystem extends createSystem({
  directors: { required: [ArcDirector] },
  exitPressed: { required: [PavilionExitSign, Pressed] },
}) {
  private stage = STAGE_ENTRANCE;
  private stageKnown = false;

  private flashBindings: FlashBinding[] = [];
  private curtainHolders: Object3D[] = [];
  private waterMesh: Object3D | undefined;
  private waterMaterial: MeshStandardMaterial | undefined;
  private mists: MistBinding[] = [];
  private sunbeamMaterial: MeshBasicMaterial | undefined;
  private heartMaterial: MeshStandardMaterial | undefined;

  private exitPanel: Object3D | undefined;
  private readonly exitPanelPosition = new Vector3();
  private exitPanelBaseScale = 1;
  private exitClickWired = false;

  private portrait: Mesh | undefined;
  private portraitMaterial: MeshBasicMaterial | undefined;
  private backdrop: Mesh | undefined;

  /** 第 1 段要隐藏的亭体外壳子树（段落灯组除外）与池面帷幕物。 */
  private shellTargets: Object3D[] = [];
  private veilTargets: Object3D[] = [];

  private songStatusWired = false;
  private songStatusShown: SongStatus | undefined;

  private enterDwell = 0;
  private exitDwell = 0;
  private flashLevel = 0;

  // 逐帧复用临时量（update 内禁止分配）。
  private readonly tempVecA = new Vector3();
  private readonly tempVecB = new Vector3();
  private readonly tempQuat = new Quaternion();

  init(): void {
    this.setupPavilion();
    this.setupPond();
    this.setupExitPanel();
    this.setupPortrait();
    this.cleanupFuncs.push(
      this.queries.exitPressed.subscribe('qualify', () => {
        if (this.stage === STAGE_LOTUS) this.exitToCentre();
      }),
    );
  }

  private setupPavilion(): void {
    const pavilion = this.world.getSceneObject('lotus-pavilion');
    if (pavilion == null) return;
    // 闪光材质：亭身全部标准材质，排除段落灯灯球（ArcSystem 驱动）。
    const seen = new Set<MeshStandardMaterial>();
    pavilion.traverse((child) => {
      if (!(child instanceof Mesh)) return;
      const materials = Array.isArray(child.material)
        ? child.material
        : [child.material];
      for (const material of materials) {
        if (
          material instanceof MeshStandardMaterial &&
          material.emissive.getHex() !== LAMP_BULB_EMISSIVE &&
          !seen.has(material)
        ) {
          seen.add(material);
          this.flashBindings.push({
            material,
            baseEmissiveHex: material.emissive.getHex(),
            baseIntensity: material.emissiveIntensity,
          });
        }
      }
    });
    const curtains = pavilion.getObjectByName('pavilion-curtains');
    if (curtains != null) {
      this.curtainHolders = curtains.children.slice();
    }
    // 亭内模式（第 1 段）要隐藏的外壳：以亭资产根（轻纱组的父级）
    // 的直属子级为单位分拣——含网格且不含段落灯灯球者全藏；灯组
    // 保留（灯光呼吸是背景的一部分），节点直属的 PointLight 子
    // 对象不在资产根下、不受影响。
    const assetRoot = curtains?.parent ?? pavilion;
    for (const child of assetRoot.children) {
      if (!subtreeHasMesh(child)) continue;
      if (subtreeHasLampBulb(child)) continue;
      this.shellTargets.push(child);
    }
    console.info(
      `[PavilionSystem] stage-1 shell hide targets: ${this.shellTargets.length}`,
    );
  }

  private setupPond(): void {
    const pond = this.world.getSceneObject('lotus-pond');
    if (pond == null) return;
    this.waterMesh = pond.getObjectByName('pond-water') ?? undefined;
    if (this.waterMesh instanceof Mesh) {
      const material = this.waterMesh.material;
      if (material instanceof MeshStandardMaterial) {
        this.waterMaterial = material;
      }
    }
    for (let i = 0; i < 2; i++) {
      const mist = pond.getObjectByName(`pond-mist-${i}`);
      if (mist instanceof Mesh) {
        // 薄雾盘是水平透明薄片，第 1 段会切过画像/背景面，亭内
        // 模式下隐藏（见卷首第三批说明），出亭恢复。
        this.veilTargets.push(mist);
        const material = mist.material;
        if (material instanceof MeshBasicMaterial) {
          this.mists.push({
            object: mist,
            material,
            baseX: mist.position.x,
            baseOpacity: material.opacity,
          });
        }
      }
    }
    const sunbeam = pond.getObjectByName('pond-sunbeam');
    if (sunbeam instanceof Mesh) {
      this.veilTargets.push(sunbeam);
      const material = sunbeam.material;
      if (material instanceof MeshBasicMaterial) {
        this.sunbeamMaterial = material;
      }
    }
    // 莲心微光材质（全池共享一份）：花心 emissive 金黄，按色认领。
    pond.traverse((child) => {
      if (this.heartMaterial != null || !(child instanceof Mesh)) return;
      const materials = Array.isArray(child.material)
        ? child.material
        : [child.material];
      for (const material of materials) {
        if (
          material instanceof MeshStandardMaterial &&
          material.emissive.getHex() === 0xffc44d
        ) {
          this.heartMaterial = material;
        }
      }
    });
  }

  private setupExitPanel(): void {
    const entity = this.world.getSceneEntity('pavilion-exit-panel');
    const object = this.world.getSceneObject('pavilion-exit-panel');
    if (entity == null || object == null) return;
    entity.addComponent(PavilionExitSign, {});
    this.exitPanel = object;
    object.getWorldPosition(this.exitPanelPosition);
    this.exitPanelBaseScale = object.scale.x;
    object.visible = false;
  }

  /**
   * 退出标志的点按通道：UIKit 面板的射线点按走元素 click 事件
   * （与欢迎板 Enter XR 按钮同一机制，见 panel.ts），不经 ECS
   * Pressed——面板文档异步装配完成后在此补接线（update 里重试）。
   */
  private wireExitClick(): void {
    if (this.exitClickWired) return;
    const panel =
      this.world.getSceneObject<UIKitMLAsset>('pavilion-exit-panel');
    const root = panel?.document?.rootElement;
    if (panel == null || root == null) return;
    const onClick = () => {
      if (this.stage === STAGE_LOTUS) this.exitToCentre();
    };
    root.addEventListener('click', onClick);
    this.cleanupFuncs.push(() =>
      root.removeEventListener('click', onClick),
    );
    this.exitClickWired = true;
  }

  /**
   * 亭内歌曲状态提示行（退出标志面板底部，第二批改版）：歌曲
   * 未出声绝不静默——加载中亮「歌正在加载」，重试耗尽亮
   * 「若听不到歌，请捏合或按一下」；出声后自动隐去。面板文档
   * 异步装配，update 里重试接线；状态变化时才写面板属性。
   */
  private updateSongStatusLine(): void {
    if (this.stage !== STAGE_LOTUS) return;
    const status = getSongStatus();
    if (status === this.songStatusShown && this.songStatusWired) return;
    const panel =
      this.world.getSceneObject<UIKitMLAsset>('pavilion-exit-panel');
    const box = panel?.getElementById('song-status-box');
    const zh = panel?.getElementById('song-status-zh');
    const en = panel?.getElementById('song-status-en');
    if (panel == null || box == null || zh == null || en == null) return;
    this.songStatusWired = true;
    if (status === 'loading') {
      zh.setProperties({ text: '歌正在加载' });
      en.setProperties({ text: 'THE SONG IS LOADING' });
      box.setProperties({ display: 'flex' });
    } else if (status === 'error') {
      zh.setProperties({ text: '若听不到歌，请捏合或按一下' });
      en.setProperties({
        text: 'NO SONG? PINCH, OR PRESS THE TRIGGER, AND WAIT',
      });
      box.setProperties({ display: 'flex' });
    } else {
      box.setProperties({ display: 'none' });
    }
    this.songStatusShown = status;
  }

  private setupPortrait(): void {
    // 语言规则：中文界面 → 中文 v2 像；其余（含送审默认）→ 英文像。
    const isZh = (navigator.language ?? '').toLowerCase().startsWith('zh');
    const file = isZh ? 'goddess-portrait-v2.jpg' : 'goddess-portrait-en.jpg';
    const texture = new TextureLoader().load(
      `${import.meta.env.BASE_URL}images/${file}`,
    );
    this.portraitMaterial = new MeshBasicMaterial({ map: texture });
    const mesh = new Mesh(
      new PlaneGeometry(PORTRAIT_WIDTH, PORTRAIT_HEIGHT),
      this.portraitMaterial,
    );
    mesh.name = 'pavilion-portrait';
    // 视轴正中：观众点沿视轴 2.8 m、定心眼高 1.5 m，正对观众。
    // （第二批摆在距亭轴 1.55 m 处、落在亭体内部被遮挡，本批移出。）
    mesh.position.set(
      AUDIENCE_X + VIEW_AXIS.x * PORTRAIT_DISTANCE,
      PORTRAIT_CENTER_Y,
      AUDIENCE_Z + VIEW_AXIS.z * PORTRAIT_DISTANCE,
    );
    mesh.lookAt(AUDIENCE_X, PORTRAIT_CENTER_Y, AUDIENCE_Z);
    mesh.visible = false;
    this.portrait = mesh;
    this.world.createTransformEntity(mesh, { persistent: true });

    // 莲池背景像（Solomon 亲发晨光莲池图）：立于画像之后 6.2 m，
    // 大幅 16:9；整面按 BACKDROP_AXIS_SHIFT 左移，让图中亭心对
    // 正视轴、被居中画像覆住。只在第 1 段与画像一同显形。
    const backdropTexture = new TextureLoader().load(
      `${import.meta.env.BASE_URL}images/lotus-pond-backdrop.jpg`,
    );
    const backdrop = new Mesh(
      new PlaneGeometry(BACKDROP_WIDTH, BACKDROP_HEIGHT),
      new MeshBasicMaterial({ map: backdropTexture }),
    );
    backdrop.name = 'pavilion-backdrop';
    backdrop.position.set(
      AUDIENCE_X +
        VIEW_AXIS.x * BACKDROP_DISTANCE -
        VIEW_RIGHT.x * BACKDROP_AXIS_SHIFT,
      BACKDROP_CENTER_Y,
      AUDIENCE_Z +
        VIEW_AXIS.z * BACKDROP_DISTANCE -
        VIEW_RIGHT.z * BACKDROP_AXIS_SHIFT,
    );
    backdrop.lookAt(AUDIENCE_X, BACKDROP_CENTER_Y, AUDIENCE_Z);
    backdrop.visible = false;
    this.backdrop = backdrop;
    this.world.createTransformEntity(backdrop, { persistent: true });
  }

  /** 段落切换时的进出动作：起歌/停歌、退出标志与画像显隐。 */
  private onStageChanged(next: number): void {
    const wasLotus = this.stage === STAGE_LOTUS;
    this.stage = next;
    this.enterDwell = 0;
    this.exitDwell = 0;
    if (next === STAGE_LOTUS) {
      requestSongPlay();
      if (this.exitPanel != null) this.exitPanel.visible = true;
      if (this.portrait != null) {
        this.portrait.visible = PAVILION_PORTRAIT_MODE;
      }
      if (this.backdrop != null) {
        this.backdrop.visible = PAVILION_PORTRAIT_MODE;
      }
      // 亭内模式：藏亭体外壳与池面帷幕，只留莲池、段落灯、
      // 背景像与正中画像（Solomon 第三批亲定）。
      for (const target of this.shellTargets) target.visible = false;
      for (const target of this.veilTargets) target.visible = false;
    } else {
      if (wasLotus) requestSongStop();
      if (this.exitPanel != null) this.exitPanel.visible = false;
      if (this.portrait != null) this.portrait.visible = false;
      if (this.backdrop != null) this.backdrop.visible = false;
      for (const target of this.shellTargets) target.visible = true;
      for (const target of this.veilTargets) target.visible = true;
    }
  }

  private exitToCentre(): void {
    this.exitDwell = 0;
    requestArcTravel(STAGE_ENTRANCE);
  }

  private readDirector(): { stage: number; transitionPhase: number } | undefined {
    for (const entity of this.queries.directors.entities) {
      return {
        stage: entity.getValue(ArcDirector, 'stage') ?? 0,
        transitionPhase:
          entity.getValue(ArcDirector, 'transitionPhase') ?? 0,
      };
    }
    return undefined;
  }

  /** 头部射线与目标点的夹角余弦（> 阈值即算注视命中）。 */
  private headAimCosine(target: Vector3): number {
    this.player.head.getWorldPosition(this.tempVecA);
    this.player.head.getWorldQuaternion(this.tempQuat);
    this.tempVecB.set(0, 0, -1).applyQuaternion(this.tempQuat);
    this.tempVecA.subVectors(target, this.tempVecA).normalize();
    return this.tempVecA.dot(this.tempVecB);
  }

  private handAimHitsPavilion(): boolean {
    for (const side of ['left', 'right'] as const) {
      const raySpace = this.player.raySpaces[side];
      raySpace.getWorldPosition(this.tempVecA);
      raySpace.getWorldQuaternion(this.tempQuat);
      this.tempVecB.set(0, 0, -1).applyQuaternion(this.tempQuat);
      this.tempVecA.subVectors(PAVILION_TARGET, this.tempVecA).normalize();
      if (this.tempVecA.dot(this.tempVecB) > ENTER_MAX_ANGLE_COS) {
        return true;
      }
    }
    return false;
  }

  update(delta: number, time: number): void {
    this.wireExitClick();
    this.updateSongStatusLine();
    const director = this.readDirector();
    if (director != null) {
      if (!this.stageKnown || director.stage !== this.stage) {
        this.stageKnown = true;
        this.onStageChanged(director.stage);
      }
    }
    const transitioning = (director?.transitionPhase ?? 0) !== 0;

    this.updateLivingScene(time);
    this.updateFlash(delta, time);

    if (transitioning) {
      this.enterDwell = 0;
      this.exitDwell = 0;
      return;
    }

    if (this.stage === STAGE_ENTRANCE) {
      // 注视亭身：进度即闪光强度，满格直接进入。
      const aimed = this.headAimCosine(PAVILION_TARGET) > ENTER_MAX_ANGLE_COS;
      if (aimed) {
        this.enterDwell += delta;
        if (this.enterDwell >= ENTER_GAZE_DWELL_SECONDS) {
          this.enterDwell = 0;
          requestArcTravel(STAGE_LOTUS);
          return;
        }
      } else {
        this.enterDwell = 0;
      }
      // 扳机/捏合直瞄亭身：select 起始且射线对准即进入。
      const selectStart =
        this.input.xr.getSelectState('left').start ||
        this.input.xr.getSelectState('right').start;
      if (selectStart && this.handAimHitsPavilion()) {
        requestArcTravel(STAGE_LOTUS);
      }
    } else if (this.stage === STAGE_LOTUS) {
      // 注视退出标志：面板随进度微放大作反馈，满 1 s 回中央。
      const aimed =
        this.headAimCosine(this.exitPanelPosition) > EXIT_MAX_ANGLE_COS;
      if (aimed) {
        this.exitDwell += delta;
        if (this.exitDwell >= EXIT_GAZE_DWELL_SECONDS) {
          this.exitToCentre();
          return;
        }
      } else {
        this.exitDwell = 0;
      }
      if (this.exitPanel != null) {
        const progress = this.exitDwell / EXIT_GAZE_DWELL_SECONDS;
        const scale = this.exitPanelBaseScale * (1 + 0.13 * progress);
        this.exitPanel.scale.setScalar(scale);
      }
    }
  }

  /** 亭身闪光：注视进度驱动强度，带快速脉动；离开注视平滑回落。 */
  private updateFlash(delta: number, time: number): void {
    const target =
      this.stage === STAGE_ENTRANCE
        ? Math.min(this.enterDwell / ENTER_GAZE_DWELL_SECONDS, 1)
        : 0;
    const rate = target > this.flashLevel ? 7 : 3.5;
    this.flashLevel +=
      (target - this.flashLevel) * Math.min(1, delta * rate);
    if (this.flashLevel < 0.003 && target === 0) {
      if (this.flashLevel !== 0) {
        this.flashLevel = 0;
        for (const binding of this.flashBindings) {
          binding.material.emissive.setHex(binding.baseEmissiveHex);
          binding.material.emissiveIntensity = binding.baseIntensity;
        }
      }
      return;
    }
    const pulse = 0.78 + 0.22 * Math.sin(time * 9);
    const intensity = this.flashLevel * 1.15 * pulse;
    for (const binding of this.flashBindings) {
      binding.material.emissive.setHex(FLASH_GOLD);
      binding.material.emissiveIntensity =
        binding.baseIntensity + intensity;
    }
  }

  /** 活画：轻纱、水面、雾、光束、莲心——全部低频小幅，逐帧零分配。 */
  private updateLivingScene(time: number): void {
    for (let i = 0; i < this.curtainHolders.length; i++) {
      const holder = this.curtainHolders[i];
      holder.rotation.z = Math.sin(time * 0.8 + i * 1.7) * 0.07;
      holder.rotation.x = Math.sin(time * 0.55 + i * 2.3) * 0.045;
    }
    if (this.waterMesh != null) {
      this.waterMesh.position.y = Math.sin(time * 0.5) * 0.004;
    }
    if (this.waterMaterial != null) {
      this.waterMaterial.opacity =
        0.85 + Math.sin(time * 0.7) * 0.02;
    }
    for (let i = 0; i < this.mists.length; i++) {
      const mist = this.mists[i];
      mist.object.position.x =
        mist.baseX + Math.sin(time * 0.05 + i * 2.1) * 0.25;
      mist.material.opacity =
        mist.baseOpacity * (1 + 0.25 * Math.sin(time * 0.11 + i * 1.3));
    }
    if (this.sunbeamMaterial != null) {
      this.sunbeamMaterial.opacity =
        0.05 + 0.02 * Math.sin(time * 0.23);
    }
    if (this.heartMaterial != null) {
      this.heartMaterial.emissiveIntensity =
        2 + Math.sin(time * 1.3) * 0.3 + Math.sin(time * 3.7) * 0.18;
    }
    // 画像轻动态：亮度随歌曲真实电平呼吸（增益 1 = 基准，
    // 映射到 0.86–1.14 的颜色倍乘）；无电平时慢速正弦兜底。
    if (this.portraitMaterial != null && this.portrait?.visible) {
      const level = getSongLampLevel();
      const intensity =
        level != null
          ? Math.min(1.14, Math.max(0.86, 0.72 + level * 0.28))
          : 0.95 + 0.05 * Math.sin(time * 0.9);
      this.portraitMaterial.color.setScalar(intensity);
    }
  }
}
