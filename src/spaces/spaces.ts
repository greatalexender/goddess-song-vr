/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * 五空间组织表——段落编排的单一事实来源。
 *
 * 空间的「处所」来自 Solomon 的伊甸园原型四处停留地（莲花亭 / 真曦的
 * 长椅 / 蛇的自由花园 / AI 星光庭院），段落弧沿用设计稿的五段弧
 * （呼唤 / 回应 / 交融 / 内在之光 / 归于宁静）；第五空间无对应处所，
 * 即花园本身归于宁静。空间 1–5 已全部落地。弧外另有三处旁支：
 * 空间 6「音乐亭」（Solomon 原型里的又一处停留地，主「听与舞」）、
 * 空间 7「冥想地」（Sri Vidya，主「坐与观想」）与空间 8「每日一笑
 * 馆」（常设喜剧展馆，陈列已发布的全部笑话喜剧集，点播待公开
 * 托管），都已建实体，只在自由回访模式下可达，不占五段弧的
 * 段落序（见各条目注释）。
 * 资产注册在 src/assets.ts，场景编排在
 * public/scenes/main.iwsdk.scene.json。
 */

export type SpaceStatus = 'built' | 'placeholder';

export interface SpaceDefinition {
  /** 空间序号：1–5 与五段弧同序；6、7、8 为弧外旁支（音乐亭 / 冥想地 / 每日一笑馆）。 */
  index: number;
  /** 稳定 id，代码与文档引用以此为准。 */
  id: string;
  /** 处所名（伊甸园原型的停留地）。 */
  placeName: string;
  /** 五段弧段名。 */
  arcName: string;
  status: SpaceStatus;
  /** 该空间在 src/assets.ts 里登记的场景资产 id；占位空间为空数组。 */
  sceneAssetIds: readonly string[];
  /** 场景中该空间灯光节点的 id；音频钩子将来驱动它与灯球 emissive。 */
  lampLightNodeId?: string;
}

export const SPACES: readonly SpaceDefinition[] = [
  {
    index: 1,
    id: 'lotus-pavilion',
    placeName: '莲花亭',
    arcName: '呼唤',
    status: 'built',
    sceneAssetIds: ['lotus-pavilion', 'lotus-pond'],
    lampLightNodeId: 'lotus-pavilion-lamp-light',
  },
  {
    index: 2,
    id: 'goddess-bench',
    placeName: '真曦的长椅',
    arcName: '回应',
    status: 'built',
    sceneAssetIds: ['goddess-bench'],
    lampLightNodeId: 'goddess-bench-lamp-light',
    // 椅下另有「长椅留言层」（数字城城门口留言版在园中的落点）：
    // bench-note-marker 微光点挂在本节点下、留言面板
    // bench-notes-panel 立在椅前，只在自由回访模式下显形，五段
    // 弧进行中不存在。数据与显隐见 bench-notes.ts /
    // bench-notes-system.ts；本层零点光源，不占灯光登记。
  },
  {
    index: 3,
    id: 'serpent-garden',
    placeName: '蛇的自由花园',
    arcName: '交融',
    status: 'built',
    sceneAssetIds: ['serpent-garden'],
    lampLightNodeId: 'serpent-garden-lamp-light',
  },
  {
    index: 4,
    id: 'ai-starlight-courtyard',
    placeName: 'AI 星光庭院',
    arcName: '内在之光',
    status: 'built',
    sceneAssetIds: ['ai-starlight-courtyard'],
    // 本空间无 lampLightNodeId：它的「光」是微光球外壳与内纹的
    // emissive（资产内 orbEmissiveIntensity），不是场景点光源——
    // 全场点光源守恒 4 盏，本空间不添。音频钩子接入时改驱动
    // 微光的 emissiveIntensity，路径见 applySpaceLampAudioLevel。
  },
  {
    index: 5,
    id: 'stillness',
    placeName: '归于宁静',
    arcName: '归于宁静',
    status: 'built',
    sceneAssetIds: ['stillness-ring'],
    // 归静的「灯」就是 0 号主灯本身：灯光节点沿用 goddess-lamp 的
    // goddess-lamp-light，不另设灯。归静态的参数意图（静态值 →
    // 归静目标值；第四阶段起 ArcSystem 在第 5 段以约 0.45 的增益
    // 因子近似这组收束值，精确缓动留待音频阶段的时间轴）：
    //   PointLight intensity 8 → 2.5，distance 9 → 5，
    //   灯球 emissiveIntensity 3 → 1.2——光收束到只剩一盏小灯，
    //   与歌同熄/同留。
    lampLightNodeId: 'goddess-lamp-light',
    // 本空间**无面板、无文字**：场景里只有一圈石环（stillness-ring）
    // 与环心的空无。无字，是有意的——第五段的留白就是设计本身，
    // 不要在后续阶段给它补文案面板。
  },
  {
    index: 6,
    id: 'music-pavilion',
    placeName: '音乐亭',
    arcName: '女神之歌之家',
    status: 'built',
    sceneAssetIds: ['music-pavilion'],
    // Solomon 的伊甸园原型中另有一处「音乐亭」——《女神之歌》在
    // 园中的发声处：歌从这里起、五段弧从这里展开。它不在五段弧
    // 的段落序里，是全园的声音原点。分工：音乐亭主「听与舞」
    // （圆台舞池），冥想地主「坐与观想」，两者不混。本空间无
    // lampLightNodeId、**不配点光源**（全场点光源守恒 4 盏已满）：
    // 亭后的灯只有 emissive 灯球，ArcSystem 的 6 号绑定像星光
    // 庭院那样只驱动灯球的 emissiveIntensity 随段落呼吸。
    // 音频资产仍未接入（梵语校对红线）：歌声的空间锚点将来落在
    // 这里，届时在本条目补登记音频资产。
  },
  {
    index: 7,
    id: 'meditation-ground',
    placeName: '冥想地',
    arcName: '观想 · Sri Vidya',
    status: 'built',
    sceneAssetIds: ['meditation-seat'],
    // 冥想地（Solomon 亲点：「伊甸园的冥想地就是 Sri Vidya」）：
    // 临莲池一方坐席，坐前空中悬置一幅金线绘出的 Sri Chakra——
    // **悬空，不落地、不触水**；五段光在此收束：线条逐层向中心
    // bindu 收拢，最终只剩一点光而后归于静止（动画在
    // meditation-system.ts，测试正弦供源，音频阶段换歌曲包络）。
    // 设计纪律（与归静环同科，写死在此）：
    // - 本空间**无面板、无文字**：坐与观想不需要读字；
    // - 女神在此**不立像**：只以光（光轮）与莲（眼前的莲池）为
    //   引，观想在坐者心中显形；
    // - 呈现口径是**体验与致敬，不自称传法、不自称正宗**；
    // - 本空间无 lampLightNodeId、零点光源：光轮的金线是无光照
    //   模型的自发光材质（MeshBasicMaterial），不借段落灯通道；
    //   applySpaceLampAudioLevel 的 7 号位置为音频阶段预留
    //   （ArcSystem 无 7 号绑定，当前调用安全空转）。
  },
  {
    index: 8,
    id: 'comedy-theater',
    placeName: '每日一笑馆',
    arcName: '园子的笑声存档',
    status: 'built',
    sceneAssetIds: ['comedy-theater'],
    // 每日一笑馆（Solomon 亲题，2026-10-26）：园子的常设喜剧
    // 展馆——有墙有门洞的小馆，进门是海报墙，正面一块银幕，
    // 踏入后在选集面板上点选咱们已发布的全部笑话喜剧集。
    // 定位与分工：音乐亭放歌、冥想地静坐、笑馆放笑——园里
    // 「有存量、来客有事做」的第三件设施（前两件是长椅留言
    // 层与五处停留地）。
    // - 目录是**数据驱动**的：单一事实来源在
    //   public/comedy-catalog.json，加新集只改 JSON 不动代码
    //   （数据层 comedy-catalog.ts，面板系统
    //   comedy-catalog-system.ts）；
    // - v1 只立馆与目录：银幕是深色微光面（未开播），点选只
    //   亮标题卡；**点播待公开托管**——播放源接口只在
    //   comedy-catalog.ts 的 presentEpisode 一处，将来把托管
    //   视频纹理挂上 comedy-screen 网格即可；
    // - 本空间无 lampLightNodeId、零点光源（全场守恒 4 盏）：
    //   银幕微光是它自己材质的 emissive，不借段落灯通道，
    //   applySpaceLampAudioLevel 的 8 号位置安全空转。
  },
];

/**
 * 音频 → 灯光的驱动钩子（第四阶段已接通，驱动方是 ArcSystem）。
 *
 * level 在这里是「灯光增益」而不是原始声压：1 = 该空间的静态基准
 * 亮度。第四阶段没有真实音频（梵语校对红线未过），ArcSystem 用
 * 一条缓慢正弦测试曲线供给 0.85–1.15 的增益，让当前空间的段落灯
 * 先「呼吸」起来；音频阶段接入改编版后，只需把声压/呼吸感映射到
 * 同一增益区间再调用本函数，签名与灯光侧都不用改。
 *
 * spaceIndex 与 SPACES.index 对齐（1–5）；0 表示入口——入口没有
 * 自己的灯，借 0 号主灯（与空间 5 共用 goddess-lamp-light），
 * ArcSystem 的驱动实现里 0 与 5 落到同一盏灯。弧外旁支：6 号
 * （音乐亭）由 ArcSystem 的 6 号绑定承接（只有灯球 emissive，
 * 无点光源）；7 号（冥想地）是预留位——冥想地的收束动画当前由
 * MeditationSystem 以同一增益语义内部驱动，音频阶段如需统一走
 * 本钩子，只需给 7 号补绑定，本签名不变。8 号（每日一笑馆）
 * 同为无绑定预留位：银幕微光由 ComedyCatalogSystem 直接调它
 * 自己材质的 emissive，不经本钩子。
 *
 * 驱动注册：ArcSystem 在 init 时 registerSpaceLampDriver，销毁时
 * 调用返回的注销函数。没有驱动注册时（如编辑器预览）本函数为空
 * 操作，场景保持各空间的静态点亮值。
 */
export type SpaceLampDriver = (spaceIndex: number, level: number) => void;

let activeSpaceLampDriver: SpaceLampDriver | undefined;

export function registerSpaceLampDriver(
  driver: SpaceLampDriver,
): () => void {
  activeSpaceLampDriver = driver;
  return () => {
    if (activeSpaceLampDriver === driver) {
      activeSpaceLampDriver = undefined;
    }
  };
}

export function applySpaceLampAudioLevel(
  spaceIndex: number,
  level: number,
): void {
  activeSpaceLampDriver?.(spaceIndex, level);
}
