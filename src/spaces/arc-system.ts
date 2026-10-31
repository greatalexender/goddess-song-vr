/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import {
  createSystem,
  Group,
  Matrix4,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  Object3D,
  PlaneGeometry,
  PointLightComponent,
  Pressed,
  Quaternion,
  Vector3,
} from '@iwsdk/core';
import type { Entity } from '@iwsdk/core';
import { ArcDirector, LandingMarker } from './arc-components.js';
import {
  applySpaceLampAudioLevel,
  registerSpaceLampDriver,
  SPACES,
} from './spaces.js';

/**
 * 第四阶段 · 交互层：段落状态机 + 空间移动 + 手势 + 灯光呼吸。
 *
 * 段落序（与 SPACES.index 对齐，0 为入口序章）：
 *   0 入口 → 1 莲花亭·呼唤 → 2 长椅·回应 → 3 蛇园·交融
 *   → 4 星光庭院·内在之光 → 5 归于宁静 →（完成后自由回访）
 *
 * 推进模型：每个空间先以「一个大手势」完成本段（手势表见
 * GESTURE_BY_STAGE），完成后该段通往下一空间的落点标记被点亮；
 * 访客注视标记停留约 1.2 秒、或对着标记捏合，即淡出 → 换位 →
 * 淡入到下一空间的观众点。入口无手势，标记一开始就是亮的。
 * 第 5 段完成后进入自由回访：归静处一排小光点亮起，任一标记
 * （含各空间的大标记）都可直接确认前往，不再要求手势。
 *
 * 弧外旁支（第五阶段）：阶段 6 = 音乐亭、7 = 冥想地——不在段落
 * 序里，没有手势、不推进弧，只在自由回访模式下经归静处新增的
 * 两枚回访小点到达；观众点登记在 STAGE_VIEWS 的 6、7 号位。
 * 音乐亭的灯球 emissive 挂 6 号灯光绑定（无点光源），到访时随
 * 呼吸驱动；冥想地不挂绑定（其光轮由 MeditationSystem 自驱动）。
 * 第六阶段再加阶段 8 = 每日一笑馆：同样只在自由回访可达（回访
 * 小点排在冥想地之后），观众点在 STAGE_VIEWS 的 8 号位（馆内
 * 门前，面朝银幕）；不挂灯光绑定（银幕微光由
 * ComedyCatalogSystem 自管），applyLampLevel(8, …) 安全空转。
 *
 * 兜底：手势识别不到时，任意捏合并保持 2 秒视为完成本段手势
 * （各空间面板角落有中英文小字提示）。手势判定每约 100 ms 采样
 * 一次，全部逐帧逻辑不分配对象（向量/矩阵都是类字段复用）。
 *
 * 灯光：本系统是 applySpaceLampAudioLevel 的注册驱动方。当前
 * 段落的灯以 16 秒周期的正弦增益 0.85–1.15「呼吸」（测试曲线，
 * 音频阶段换源即可，见 spaces.ts 的钩子说明）；非当前空间回到
 * 0.82 的静息增益，让「当前空间被高亮」读得出来。第 5 段的主灯
 * 另乘约 0.45 的归因子收束。星光庭院的微光内纹子组
 * （starlight-orb-core）以 48 秒一圈极慢旋转。
 *
 * 移动纪律：坐姿友好——只有淡出/淡入换位，没有摇杆飞行、没有
 * 连续位移；换位直接设置玩家 XROrigin 的位置与朝向。
 */

/** 阶段编号：0 入口，1–5 与 SPACES.index 相同。 */
const STAGE_ENTRANCE = 0;
const STAGE_STILLNESS = 5;

/** 每段的观众点：[x, z, 朝向 yaw（度，0 = 看向 -Z）]；6、7、8 为弧外旁支。 */
const STAGE_VIEWS: ReadonlyArray<readonly [number, number, number]> = [
  [0, 1, 0],
  [-4.55, -3.15, 36],
  [5.55, -5.05, -45],
  [5.15, 2.15, -135],
  [2, -7.35, 0],
  [-2.4, 4.75, 0],
  [-5.9, 3.35, 108],
  [-5.75, 1.35, -19],
  [0.5, 8.4, 180],
];

/** 大标记（落在目标空间观众点前方约 0.55 m 的地面上）。 */
const SPACE_MARKER_NODES: ReadonlyArray<{
  nodeId: string;
  targetStage: number;
}> = [
  { nodeId: 'landing-marker-entrance', targetStage: 0 },
  { nodeId: 'landing-marker-lotus', targetStage: 1 },
  { nodeId: 'landing-marker-bench', targetStage: 2 },
  { nodeId: 'landing-marker-serpent', targetStage: 3 },
  { nodeId: 'landing-marker-starlight', targetStage: 4 },
  { nodeId: 'landing-marker-stillness', targetStage: 5 },
];

/** 归静处的回访小点（完成第 5 段后才显形）。 */
const REVISIT_MARKER_NODES: ReadonlyArray<{
  nodeId: string;
  targetStage: number;
}> = [
  { nodeId: 'revisit-marker-lotus', targetStage: 1 },
  { nodeId: 'revisit-marker-bench', targetStage: 2 },
  { nodeId: 'revisit-marker-serpent', targetStage: 3 },
  { nodeId: 'revisit-marker-starlight', targetStage: 4 },
  { nodeId: 'revisit-marker-stillness', targetStage: 5 },
  { nodeId: 'revisit-marker-music', targetStage: 6 },
  { nodeId: 'revisit-marker-meditation', targetStage: 7 },
  { nodeId: 'revisit-marker-comedy', targetStage: 8 },
];

const GAZE_DWELL_SECONDS = 1.2;
const FALLBACK_PINCH_SECONDS = 2;
const SAMPLE_INTERVAL_SECONDS = 0.1;
const FADE_OUT_SECONDS = 0.38;
const FADE_HOLD_SECONDS = 0.08;
const FADE_IN_SECONDS = 0.5;
const BREATH_PERIOD_SECONDS = 16;
const ORB_ROTATION_PERIOD_SECONDS = 48;
const IDLE_GAIN = 0.82;
const STILLNESS_GAIN_FACTOR = 0.45;

interface EmissiveBinding {
  material: MeshStandardMaterial;
  base: number;
}

interface LampBinding {
  lightEntity?: Entity;
  baseIntensity: number;
  bulbs: EmissiveBinding[];
}

interface MarkerRecord {
  nodeId: string;
  targetStage: number;
  revisit: boolean;
  object: Object3D;
  materials: EmissiveBinding[];
  worldPosition: Vector3;
}

/**
 * 一只手的关节采样快照（全部字段预分配，采样时原地写入）。
 * 关节世界坐标由 IWSDK 手部适配器的 jointTransforms（相对 grip
 * 空间的矩阵数组）乘以 grip 空间的世界矩阵得到。
 */
class HandState {
  tracked = false;
  readonly wrist = new Vector3();
  readonly thumbTip = new Vector3();
  readonly indexMcp = new Vector3();
  readonly indexProx = new Vector3();
  readonly indexInter = new Vector3();
  readonly indexTip = new Vector3();
  readonly middleMcp = new Vector3();
  readonly middleProx = new Vector3();
  readonly middleInter = new Vector3();
  readonly middleTip = new Vector3();
  readonly ringMcp = new Vector3();
  readonly ringProx = new Vector3();
  readonly ringInter = new Vector3();
  readonly ringTip = new Vector3();
  readonly pinkyMcp = new Vector3();
  readonly pinkyProx = new Vector3();
  readonly pinkyInter = new Vector3();
  readonly pinkyTip = new Vector3();
  /** 掌心：腕 + 食指根 + 小指根的 centroid。 */
  readonly center = new Vector3();
  /** 掌面法线（指向掌心一侧的世界向量）。 */
  readonly palmNormal = new Vector3();
  readonly prevCenter = new Vector3();
  hasPrevCenter = false;
  speed = 0;
  extendedCount = 0;
  /** 上一采样到胸口锚点的距离（轻点胸前手势的接近判定用）。 */
  prevChestDistance = Number.POSITIVE_INFINITY;

  /** 按关节名取目标向量；不关心的关节返回 undefined。 */
  jointTarget(jointName: string): Vector3 | undefined {
    switch (jointName) {
      case 'wrist':
        return this.wrist;
      case 'thumb-tip':
        return this.thumbTip;
      case 'index-finger-metacarpal':
        return this.indexMcp;
      case 'index-finger-phalanx-proximal':
        return this.indexProx;
      case 'index-finger-phalanx-intermediate':
        return this.indexInter;
      case 'index-finger-tip':
        return this.indexTip;
      case 'middle-finger-metacarpal':
        return this.middleMcp;
      case 'middle-finger-phalanx-proximal':
        return this.middleProx;
      case 'middle-finger-phalanx-intermediate':
        return this.middleInter;
      case 'middle-finger-tip':
        return this.middleTip;
      case 'ring-finger-metacarpal':
        return this.ringMcp;
      case 'ring-finger-phalanx-proximal':
        return this.ringProx;
      case 'ring-finger-phalanx-intermediate':
        return this.ringInter;
      case 'ring-finger-tip':
        return this.ringTip;
      case 'pinky-finger-metacarpal':
        return this.pinkyMcp;
      case 'pinky-finger-phalanx-proximal':
        return this.pinkyProx;
      case 'pinky-finger-phalanx-intermediate':
        return this.pinkyInter;
      case 'pinky-finger-tip':
        return this.pinkyTip;
      default:
        return undefined;
    }
  }
}

const CIRCLE_BUFFER_SIZE = 24;

/** 画圆判定用的定长环形缓冲（头部局部坐标），预分配不扩容。 */
class CircleTrace {
  readonly positions = new Float32Array(CIRCLE_BUFFER_SIZE * 3);
  head = 0;
  count = 0;

  push(x: number, y: number, z: number): void {
    const offset = this.head * 3;
    this.positions[offset] = x;
    this.positions[offset + 1] = y;
    this.positions[offset + 2] = z;
    this.head = (this.head + 1) % CIRCLE_BUFFER_SIZE;
    if (this.count < CIRCLE_BUFFER_SIZE) this.count++;
  }

  reset(): void {
    this.head = 0;
    this.count = 0;
  }
}

export class ArcSystem extends createSystem({
  markers: { required: [LandingMarker] },
  pressedMarkers: { required: [LandingMarker, Pressed] },
}) {
  private director!: Entity;
  private readonly markerRecords: MarkerRecord[] = [];
  private readonly recordByEntity = new Map<Entity, MarkerRecord>();
  private readonly lampBindings: Array<LampBinding | undefined> = [
    undefined,
    undefined,
    undefined,
    undefined,
    undefined,
    undefined,
    undefined,
    undefined,
    undefined,
  ];
  private orbCore: Object3D | undefined;
  private fadeMaterial!: MeshBasicMaterial;

  private stage = STAGE_ENTRANCE;
  private gestureComplete = true;
  private freeRevisit = false;
  private transitionPhase = 0;
  private transitionElapsed = 0;
  private pendingStage = -1;

  private sampleAccumulator = 0;
  private readonly leftHand = new HandState();
  private readonly rightHand = new HandState();
  private readonly leftTrace = new CircleTrace();
  private readonly rightTrace = new CircleTrace();
  private openPalmsHold = 0;
  private palmsTogetherHold = 0;
  private stillHold = 0;
  private fallbackPinchHold = 0;
  private overlapCount = 0;
  private lastOverlapAt = -10;
  private firstOverlapAt = -10;
  private gazeNodeId: string | undefined;
  private gazeSeconds = 0;

  // 逐帧复用的临时量（update 内禁止分配）。
  private readonly tempMatrix = new Matrix4();
  private readonly tempVecA = new Vector3();
  private readonly tempVecB = new Vector3();
  private readonly tempVecC = new Vector3();
  private readonly tempQuat = new Quaternion();

  init(): void {
    // 段落状态单例：一个持久实体挂 ArcDirector，供检查工具读状态。
    const holder = new Group();
    this.director = this.world.createTransformEntity(holder, {
      persistent: true,
    });
    this.director.addComponent(ArcDirector, {});

    // 淡出/淡入幕：贴在头显前方 0.3 m 的黑面，depthTest 关掉保证
    // 它盖住一切（包括手部模型），只在换位时短暂出现。
    this.fadeMaterial = new MeshBasicMaterial({
      color: '#000000',
      transparent: true,
      opacity: 0,
      depthTest: false,
      depthWrite: false,
    });
    const fadeMesh = new Mesh(
      new PlaneGeometry(2.4, 2.4),
      this.fadeMaterial,
    );
    fadeMesh.renderOrder = 999;
    fadeMesh.frustumCulled = false;
    fadeMesh.position.set(0, 0, -0.3);
    this.world.createTransformEntity(fadeMesh, {
      parent: this.world.playerHeadEntity,
      persistent: true,
    });

    this.setupMarkers();
    this.setupLamps();
    this.cleanupFuncs.push(
      registerSpaceLampDriver((spaceIndex, level) =>
        this.applyLampLevel(spaceIndex, level),
      ),
      this.queries.pressedMarkers.subscribe('qualify', (entity) => {
        const record = this.recordByEntity.get(entity);
        if (record) this.tryConfirmMarker(record);
      }),
    );

    this.setPlayerView(this.stage);
    this.syncDirector();
  }

  private setupMarkers(): void {
    const register = (
      nodeId: string,
      targetStage: number,
      revisit: boolean,
    ): void => {
      const entity = this.world.getSceneEntity(nodeId);
      const object = this.world.getSceneObject(nodeId);
      if (entity == null || object == null) return;
      entity.addComponent(LandingMarker, { targetStage, revisit });
      const materials: EmissiveBinding[] = [];
      collectEmissiveMaterials(object, materials);
      const record: MarkerRecord = {
        nodeId,
        targetStage,
        revisit,
        object,
        materials,
        worldPosition: object.getWorldPosition(new Vector3()),
      };
      if (revisit) object.visible = false;
      this.markerRecords.push(record);
      this.recordByEntity.set(entity, record);
    };
    for (const marker of SPACE_MARKER_NODES) {
      register(marker.nodeId, marker.targetStage, false);
    }
    for (const marker of REVISIT_MARKER_NODES) {
      register(marker.nodeId, marker.targetStage, true);
    }
  }

  private setupLamps(): void {
    // 灯光节点 id 以 SPACES 登记为准（单一事实来源）；资产节点 id
    // 是场景编排的名字，在此对照一次。
    const assetNodeBySpace: Readonly<Record<number, string>> = {
      1: 'lotus-pavilion',
      2: 'goddess-bench',
      3: 'serpent-garden',
      4: 'ai-starlight-courtyard',
      5: 'goddess-lamp',
    };
    for (let spaceIndex = 1; spaceIndex <= 5; spaceIndex++) {
      const definition = SPACES.find((space) => space.index === spaceIndex);
      const assetObject = this.world.getSceneObject(
        assetNodeBySpace[spaceIndex],
      );
      if (assetObject == null) continue;
      const binding: LampBinding = { baseIntensity: 0, bulbs: [] };
      const lightNodeId = definition?.lampLightNodeId;
      if (lightNodeId != null) {
        const lightEntity = this.world.getSceneEntity(lightNodeId);
        if (lightEntity != null) {
          binding.lightEntity = lightEntity;
          binding.baseIntensity =
            lightEntity.getValue(PointLightComponent, 'intensity') ?? 0;
        }
      }
      if (spaceIndex === 4) {
        // 星光庭院没有点光源：驱动对象是微光外壳（半透明、emissive
        // 青）与内纹子组的全部发光材质；内纹组另做极慢旋转。
        this.orbCore = assetObject.getObjectByName('starlight-orb-core');
        if (this.orbCore != null) {
          collectEmissiveMaterials(this.orbCore, binding.bulbs);
        }
        collectEmissiveMaterials(assetObject, binding.bulbs, (material) =>
          material.transparent && material.emissive.getHex() === 0x8fe0d2,
        );
      } else {
        // 各空间的灯球：goddess-lamp 工厂的暖橙 emissive，按色认领。
        collectEmissiveMaterials(
          assetObject,
          binding.bulbs,
          (material) => material.emissive.getHex() === 0xffb84d,
        );
      }
      this.lampBindings[spaceIndex] = binding;
    }
    // 音乐亭（6 号，弧外旁支）：没有点光源，驱动对象只有亭后灯的
    // 灯球 emissive（goddess-lamp 工厂的暖橙色），与星光庭院同法。
    // 冥想地（7 号）不设绑定：光轮由 MeditationSystem 自驱动，
    // applyLampLevel(7, …) 在此是安全空转（预留位，见 spaces.ts）。
    // 每日一笑馆（8 号）同样不设绑定：银幕微光由
    // ComedyCatalogSystem 直接调银幕材质，applyLampLevel(8, …)
    // 安全空转。
    const musicPavilion = this.world.getSceneObject('music-pavilion');
    if (musicPavilion != null) {
      const binding: LampBinding = { baseIntensity: 0, bulbs: [] };
      collectEmissiveMaterials(
        musicPavilion,
        binding.bulbs,
        (material) => material.emissive.getHex() === 0xffb84d,
      );
      this.lampBindings[6] = binding;
    }
    // 入口与归静共用 0 号主灯：0 号绑定直接指向空间 5 的绑定。
    this.lampBindings[0] = this.lampBindings[STAGE_STILLNESS];
  }

  /** applySpaceLampAudioLevel 的驱动实现：按增益调一盏段落灯。 */
  private applyLampLevel(spaceIndex: number, level: number): void {
    const binding = this.lampBindings[spaceIndex];
    if (binding == null) return;
    let gain = level;
    if (spaceIndex === STAGE_STILLNESS && this.stage === STAGE_STILLNESS) {
      gain *= STILLNESS_GAIN_FACTOR;
    }
    if (binding.lightEntity != null) {
      binding.lightEntity.setValue(
        PointLightComponent,
        'intensity',
        binding.baseIntensity * gain,
      );
    }
    for (const bulb of binding.bulbs) {
      bulb.material.emissiveIntensity = bulb.base * gain;
    }
  }

  private setPlayerView(stage: number): void {
    const [x, z, yawDeg] = STAGE_VIEWS[stage];
    this.player.position.set(x, 0, z);
    this.player.rotation.set(0, (yawDeg * Math.PI) / 180, 0);
  }

  private syncDirector(): void {
    this.director.setValue(ArcDirector, 'stage', this.stage);
    this.director.setValue(
      ArcDirector,
      'gestureComplete',
      this.gestureComplete,
    );
    this.director.setValue(ArcDirector, 'freeRevisit', this.freeRevisit);
    this.director.setValue(
      ArcDirector,
      'transitionPhase',
      this.transitionPhase,
    );
    this.director.setValue(
      ArcDirector,
      'activeTargetStage',
      this.freeRevisit
        ? -1
        : this.gestureComplete
          ? Math.min(this.stage + 1, STAGE_STILLNESS)
          : this.stage,
    );
  }

  /** 标记当前是否可被确认（段落门 + 自由回访规则都在这里）。 */
  private markerArmed(record: MarkerRecord): boolean {
    if (this.transitionPhase !== 0) return false;
    if (record.revisit) return this.freeRevisit;
    if (this.freeRevisit) return true;
    return (
      this.gestureComplete && record.targetStage === this.stage + 1
    );
  }

  private tryConfirmMarker(record: MarkerRecord): void {
    if (!this.markerArmed(record)) return;
    this.pendingStage = record.targetStage;
    this.transitionPhase = 1;
    this.transitionElapsed = 0;
    this.gazeNodeId = undefined;
    this.gazeSeconds = 0;
    this.syncDirector();
  }

  private completeGesture(): void {
    if (this.gestureComplete || this.transitionPhase !== 0) return;
    if (this.stage < 1 || this.stage > STAGE_STILLNESS) return;
    this.gestureComplete = true;
    this.resetGestureCounters();
    if (this.stage === STAGE_STILLNESS) {
      // 第 5 段完成 = 全弧走完：回访小点显形，进入自由回访。
      this.freeRevisit = true;
      for (const record of this.markerRecords) {
        if (record.revisit) record.object.visible = true;
      }
    }
    this.syncDirector();
  }

  private resetGestureCounters(): void {
    this.openPalmsHold = 0;
    this.palmsTogetherHold = 0;
    this.stillHold = 0;
    this.fallbackPinchHold = 0;
    this.overlapCount = 0;
    this.leftTrace.reset();
    this.rightTrace.reset();
    this.leftHand.prevChestDistance = Number.POSITIVE_INFINITY;
    this.rightHand.prevChestDistance = Number.POSITIVE_INFINITY;
  }

  private arriveAtPendingStage(): void {
    const previousStage = this.stage;
    this.stage = this.pendingStage;
    this.pendingStage = -1;
    this.setPlayerView(this.stage);
    if (!this.freeRevisit) {
      // 入口不需要手势；其余空间到达时先回到「待完成手势」。
      this.gestureComplete = this.stage === STAGE_ENTRANCE;
    }
    this.resetGestureCounters();
    // 上一空间的灯回静息增益，当前空间的呼吸在 update 里接管。
    applySpaceLampAudioLevel(
      previousStage === STAGE_ENTRANCE ? 0 : previousStage,
      IDLE_GAIN,
    );
    this.syncDirector();
  }

  update(delta: number, time: number): void {
    // 微光内纹极慢旋转（48 秒一圈），与呼吸同源、常开。
    if (this.orbCore != null) {
      this.orbCore.rotation.y +=
        delta * ((Math.PI * 2) / ORB_ROTATION_PERIOD_SECONDS);
    }

    // 换位淡出/停驻/淡入。
    if (this.transitionPhase !== 0) {
      this.transitionElapsed += delta;
      if (this.transitionPhase === 1) {
        const t = Math.min(this.transitionElapsed / FADE_OUT_SECONDS, 1);
        this.fadeMaterial.opacity = t;
        if (t >= 1) {
          this.arriveAtPendingStage();
          this.transitionPhase = 2;
          this.transitionElapsed = 0;
          this.syncDirector();
        }
      } else if (this.transitionPhase === 2) {
        this.fadeMaterial.opacity = 1;
        if (this.transitionElapsed >= FADE_HOLD_SECONDS) {
          this.transitionPhase = 3;
          this.transitionElapsed = 0;
          this.syncDirector();
        }
      } else {
        const t = Math.min(this.transitionElapsed / FADE_IN_SECONDS, 1);
        this.fadeMaterial.opacity = 1 - t;
        if (t >= 1) {
          this.transitionPhase = 0;
          this.transitionElapsed = 0;
          this.fadeMaterial.opacity = 0;
          this.syncDirector();
        }
      }
    }

    // 当前段落灯呼吸：正弦增益 0.85–1.15，16 秒一周期（测试曲线）。
    if (this.transitionPhase === 0) {
      const breath =
        1 +
        0.15 *
          Math.sin((time / BREATH_PERIOD_SECONDS) * Math.PI * 2);
      applySpaceLampAudioLevel(
        this.stage === STAGE_ENTRANCE ? 0 : this.stage,
        breath,
      );
    }

    this.updateMarkerPulse(time);

    // 手势与注视判定节流到约 100 ms 一次。
    this.sampleAccumulator += delta;
    if (this.sampleAccumulator < SAMPLE_INTERVAL_SECONDS) return;
    const sampleDelta = this.sampleAccumulator;
    this.sampleAccumulator = 0;
    if (this.transitionPhase !== 0) return;
    this.sampleInteractions(sampleDelta, time);
  }

  private updateMarkerPulse(time: number): void {
    const pulse = 1.3 + 0.3 * Math.sin(time * 2.4);
    for (const record of this.markerRecords) {
      if (record.revisit && !record.object.visible) continue;
      const armed = this.markerArmed(record);
      const gazed = this.gazeNodeId === record.nodeId;
      const factor = armed ? (gazed ? 1.9 : pulse) : 0.4;
      for (const binding of record.materials) {
        binding.material.emissiveIntensity = binding.base * factor;
      }
    }
  }

  private readonly tempVecD = new Vector3();
  private readonly tempQuatB = new Quaternion();

  /** 约 100 ms 一次的交互采样：注视停留、捏合确认、手势、兜底。 */
  private sampleInteractions(dt: number, time: number): void {
    this.readHand('left', this.leftHand, dt);
    this.readHand('right', this.rightHand, dt);

    const gazed = this.pickGazedMarker();

    // 捏合确认：注视或手射线对准标记时，任一手的 select 起始即确认。
    const selectStart =
      this.input.xr.getSelectState('left').start ||
      this.input.xr.getSelectState('right').start;
    if (selectStart) {
      const aimed = gazed ?? this.pickHandAimedMarker();
      if (aimed != null) {
        this.tryConfirmMarker(aimed);
        return;
      }
    }

    // 注视停留确认：对准已激活的标记约 1.2 秒。
    if (gazed != null && this.markerArmed(gazed)) {
      if (this.gazeNodeId === gazed.nodeId) {
        this.gazeSeconds += dt;
      } else {
        this.gazeNodeId = gazed.nodeId;
        this.gazeSeconds = dt;
      }
      if (this.gazeSeconds >= GAZE_DWELL_SECONDS) {
        this.tryConfirmMarker(gazed);
        return;
      }
    } else {
      this.gazeNodeId = gazed?.nodeId;
      this.gazeSeconds = 0;
    }

    // 兜底：本段手势未完成时，任意捏合并保持 2 秒视为完成手势。
    if (!this.gestureComplete && this.stage >= 1) {
      const selectActive =
        this.input.xr.getSelectState('left').active ||
        this.input.xr.getSelectState('right').active;
      if (selectActive) {
        this.fallbackPinchHold += dt;
        if (this.fallbackPinchHold >= FALLBACK_PINCH_SECONDS) {
          this.completeGesture();
          return;
        }
      } else {
        this.fallbackPinchHold = 0;
      }
    }

    if (this.gestureComplete || this.stage === STAGE_ENTRANCE) return;
    this.evaluateGesture(dt, time);
  }

  private pickGazedMarker(): MarkerRecord | undefined {
    this.player.head.getWorldPosition(this.tempVecA);
    this.player.head.getWorldQuaternion(this.tempQuat);
    this.tempVecB.set(0, 0, -1).applyQuaternion(this.tempQuat);
    return this.pickMarkerAlongRay(this.tempVecA, this.tempVecB);
  }

  private pickHandAimedMarker(): MarkerRecord | undefined {
    for (const side of ['left', 'right'] as const) {
      const raySpace = this.player.raySpaces[side];
      raySpace.getWorldPosition(this.tempVecA);
      raySpace.getWorldQuaternion(this.tempQuat);
      this.tempVecB.set(0, 0, -1).applyQuaternion(this.tempQuat);
      const hit = this.pickMarkerAlongRay(this.tempVecA, this.tempVecB);
      if (hit != null) return hit;
    }
    return undefined;
  }

  /** 射线到标记环心的垂距在容差内即算对准（容差随距离放宽）。 */
  private pickMarkerAlongRay(
    origin: Vector3,
    direction: Vector3,
  ): MarkerRecord | undefined {
    let best: MarkerRecord | undefined;
    let bestDistance = Number.POSITIVE_INFINITY;
    for (const record of this.markerRecords) {
      if (record.revisit && !record.object.visible) continue;
      this.tempVecD.subVectors(record.worldPosition, origin);
      const along = this.tempVecD.dot(direction);
      if (along < 0.4) continue;
      this.tempVecD.addScaledVector(direction, -along);
      const miss = this.tempVecD.length();
      const tolerance = record.revisit
        ? Math.max(0.22, along * 0.05)
        : Math.max(0.5, along *  0.055);
      if (miss <= tolerance && miss < bestDistance) {
        best = record;
        bestDistance = miss;
      }
    }
    return best;
  }

  private readHand(
    side: 'left' | 'right',
    hand: HandState,
    dt: number,
  ): void {
    const adapter = this.input.xr.visualAdapters.hand[side];
    const transforms = adapter.jointTransforms;
    const jointSpaces = adapter.jointSpaces;
    if (transforms == null || jointSpaces.length === 0) {
      hand.tracked = false;
      hand.hasPrevCenter = false;
      return;
    }
    const grip = this.player.gripSpaces[side];
    grip.updateWorldMatrix(true, false);
    let found = 0;
    for (let i = 0; i < jointSpaces.length; i++) {
      const target = hand.jointTarget(jointSpaces[i].jointName);
      if (target == null) continue;
      this.tempMatrix.fromArray(transforms, i * 16);
      target
        .setFromMatrixPosition(this.tempMatrix)
        .applyMatrix4(grip.matrixWorld);
      found++;
    }
    if (found < 12) {
      hand.tracked = false;
      hand.hasPrevCenter = false;
      return;
    }
    hand.tracked = true;
    hand.center
      .copy(hand.wrist)
      .add(hand.indexMcp)
      .add(hand.pinkyMcp)
      .multiplyScalar(1 / 3);
    this.tempVecA.subVectors(hand.indexMcp, hand.wrist);
    this.tempVecB.subVectors(hand.pinkyMcp, hand.wrist);
    hand.palmNormal.crossVectors(this.tempVecA, this.tempVecB);
    if (hand.palmNormal.lengthSq() < 1e-8) {
      hand.tracked = false;
      return;
    }
    hand.palmNormal.normalize();
    // 叉积方向与左右手的手性相反，左手翻一次才指向掌心一侧。
    if (side === 'left') hand.palmNormal.multiplyScalar(-1);
    hand.speed = hand.hasPrevCenter
      ? hand.center.distanceTo(hand.prevCenter) / Math.max(dt, 0.001)
      : 0;
    hand.prevCenter.copy(hand.center);
    hand.hasPrevCenter = true;
    hand.extendedCount =
      (this.fingerExtended(hand.indexMcp, hand.indexProx, hand.indexTip)
        ? 1
        : 0) +
      (this.fingerExtended(hand.middleMcp, hand.middleProx, hand.middleTip)
        ? 1
        : 0) +
      (this.fingerExtended(hand.ringMcp, hand.ringProx, hand.ringTip)
        ? 1
        : 0) +
      (this.fingerExtended(hand.pinkyMcp, hand.pinkyProx, hand.pinkyTip)
        ? 1
        : 0);
  }

  /** 手指伸直判定：根→近节与近节→指尖两段方向夹角足够小。 */
  private fingerExtended(mcp: Vector3, prox: Vector3, tip: Vector3): boolean {
    this.tempVecA.subVectors(prox, mcp);
    this.tempVecB.subVectors(tip, prox);
    const a = this.tempVecA.length();
    const b = this.tempVecB.length();
    if (a < 1e-5 || b < 1e-5) return false;
    return this.tempVecA.dot(this.tempVecB) / (a * b) > 0.7;
  }

  /** 每段一个大手势，阈值判定（设计稿五段弧 + 本阶段任务书）。 */
  private evaluateGesture(dt: number, time: number): void {
    const left = this.leftHand;
    const right = this.rightHand;

    if (this.stage === 1) {
      // 呼唤：双手摊开、掌心朝上（承接），保持约 0.6 秒。
      const open =
        left.tracked &&
        right.tracked &&
        left.extendedCount >= 3 &&
        right.extendedCount >= 3 &&
        left.palmNormal.y > 0.6 &&
        right.palmNormal.y > 0.6;
      this.openPalmsHold = open ? this.openPalmsHold + dt : 0;
      if (this.openPalmsHold >= 0.6) this.completeGesture();
      return;
    }

    if (this.stage === 2) {
      // 回应：双手合掌——掌心相对、两掌心贴近，保持约 0.6 秒。
      let together = false;
      if (left.tracked && right.tracked) {
        const distance = left.center.distanceTo(right.center);
        const facing = left.palmNormal.dot(right.palmNormal);
        together = distance < 0.17 && facing < -0.3;
      }
      this.palmsTogetherHold = together ? this.palmsTogetherHold + dt : 0;
      if (this.palmsTogetherHold >= 0.6) this.completeGesture();
      return;
    }

    if (this.stage === 3) {
      // 交融：双手交叠两次（2.5 秒内），或任一手在头部前方画圆。
      this.pushTrace(this.leftTrace, left);
      this.pushTrace(this.rightTrace, right);
      if (left.tracked && right.tracked) {
        const distance = left.center.distanceTo(right.center);
        if (distance < 0.15 && time - this.lastOverlapAt > 0.4) {
          if (this.overlapCount === 0) this.firstOverlapAt = time;
          this.overlapCount++;
          this.lastOverlapAt = time;
        }
        if (this.overlapCount >= 2 && time - this.firstOverlapAt <= 3.5) {
          this.completeGesture();
          return;
        }
        if (this.overlapCount > 0 && time - this.firstOverlapAt > 3.5) {
          this.overlapCount = 0;
        }
      }
      if (
        this.traceIsCircle(this.leftTrace) ||
        this.traceIsCircle(this.rightTrace)
      ) {
        this.completeGesture();
      }
      return;
    }

    if (this.stage === 4) {
      // 内在之光：单手轻点胸前——手掌心由远及近跨入胸口锚点范围。
      this.player.head.getWorldPosition(this.tempVecA);
      this.player.head.getWorldQuaternion(this.tempQuat);
      this.tempVecB.set(0, 0, -1).applyQuaternion(this.tempQuat);
      this.tempVecB.y = 0;
      if (this.tempVecB.lengthSq() > 0.01) this.tempVecB.normalize();
      this.tempVecC
        .copy(this.tempVecA)
        .addScaledVector(this.tempVecB, 0.1);
      this.tempVecC.y -= 0.32;
      for (const hand of [left, right]) {
        if (!hand.tracked) {
          hand.prevChestDistance = Number.POSITIVE_INFINITY;
          continue;
        }
        const distance = hand.center.distanceTo(this.tempVecC);
        const tapped =
          (hand.prevChestDistance > 0.31 && distance <= 0.31) ||
          (hand.prevChestDistance >= 0.26 && distance < 0.24);
        hand.prevChestDistance = distance;
        if (tapped) {
          this.completeGesture();
          return;
        }
      }
      return;
    }

    if (this.stage === STAGE_STILLNESS) {
      // 归于宁静：双手放下（低于头约 0.42 m）、几乎不动，满 3 秒。
      let still = false;
      if (left.tracked && right.tracked) {
        this.player.head.getWorldPosition(this.tempVecA);
        still =
          left.center.y < this.tempVecA.y - 0.42 &&
          right.center.y < this.tempVecA.y - 0.42 &&
          left.speed < 0.05 &&
          right.speed < 0.05;
      }
      this.stillHold = still ? this.stillHold + dt : 0;
      if (this.stillHold >= 3) this.completeGesture();
    }
  }

  private pushTrace(trace: CircleTrace, hand: HandState): void {
    if (!hand.tracked) return;
    this.player.head.getWorldPosition(this.tempVecA);
    this.player.head.getWorldQuaternion(this.tempQuatB);
    this.tempQuatB.invert();
    this.tempVecB
      .subVectors(hand.center, this.tempVecA)
      .applyQuaternion(this.tempQuatB);
    trace.push(this.tempVecB.x, this.tempVecB.y, this.tempVecB.z);
  }

  private traceIsCircle(trace: CircleTrace): boolean {
    if (trace.count < 16) return false;
    let path = 0;
    let minX = Number.POSITIVE_INFINITY;
    let maxX = Number.NEGATIVE_INFINITY;
    let minY = Number.POSITIVE_INFINITY;
    let maxY = Number.NEGATIVE_INFINITY;
    let firstX = 0;
    let firstY = 0;
    let firstZ = 0;
    let prevX = 0;
    let prevY = 0;
    let prevZ = 0;
    let lastX = 0;
    let lastY = 0;
    let lastZ = 0;
    for (let i = 0; i < trace.count; i++) {
      const index =
        (trace.head - trace.count + i + CIRCLE_BUFFER_SIZE) %
        CIRCLE_BUFFER_SIZE;
      const x = trace.positions[index * 3];
      const y = trace.positions[index * 3 + 1];
      const z = trace.positions[index * 3 + 2];
      if (i === 0) {
        firstX = x;
        firstY = y;
        firstZ = z;
      } else {
        path += Math.hypot(x - prevX, y - prevY, z - prevZ);
      }
      prevX = x;
      prevY = y;
      prevZ = z;
      lastX = x;
      lastY = y;
      lastZ = z;
      minX = Math.min(minX, x);
      maxX = Math.max(maxX, x);
      minY = Math.min(minY, y);
      maxY = Math.max(maxY, y);
    }
    const net = Math.hypot(lastX - firstX, lastY - firstY, lastZ - firstZ);
    return path > 0.5 && maxX - minX > 0.14 && maxY - minY > 0.12 && net < 0.22;
  }
}

/** 收集一个对象子树里全部（或过滤后）的 emissive 材质及其基准强度。 */
function collectEmissiveMaterials(
  root: Object3D,
  out: EmissiveBinding[],
  filter?: (material: MeshStandardMaterial) => boolean,
): void {
  const seen = new Set<MeshStandardMaterial>();
  root.traverse((child) => {
    if (!(child instanceof Mesh)) return;
    const materials = Array.isArray(child.material)
      ? child.material
      : [child.material];
    for (const material of materials) {
      if (
        material instanceof MeshStandardMaterial &&
        !seen.has(material) &&
        (filter == null || filter(material))
      ) {
        seen.add(material);
        out.push({ material, base: material.emissiveIntensity });
      }
    }
  });
}
