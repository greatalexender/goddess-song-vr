/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * 每日一笑馆 · 剧集目录数据层（v1，先立馆与目录，播放待托管）。
 *
 * 目录的单一事实来源是 public/comedy-catalog.json——**数据驱动**：
 * 将来加新集，只往 JSON 的 episodes 末尾追加一条，本模块、选集
 * 面板（comedy-catalog-system.ts）与银幕标题卡都不用改。首批条目
 * 的 YouTube 编号由任务书逐条核定，只许用那一批；各集 title 是
 * 发布主标题原文，出处逐条如下（2026-10-26 查档）：
 * - EP01/EP02：各集《发布就绪包》（goals/zhenxi-and-the-serpent-
 *   of-eden/files/EP0N_发布就绪包）所载标题，EP01 另经发布记录
 *   逐字核验（memory/2026-10-14.md）；
 * - EP03：发布记录逐字（memory/2026-10-15.md）；
 * - EP04：EP04 发布就绪包主标题（现行版 i9XBp0sWJHw 平移沿用）；
 * - EP05：发布规格所载主标题（memory/2026-10-17.md）；
 * - EP07：Solomon 拍板的主标题口径（memory/2026-10-18.md，
 *   不带系列后缀）；
 * - EP08：发布记录逐字（memory/2026-10-17.md）；
 * - EP09：EP09 发布记录逐字（production/ep09/publish/
 *   发布记录_EP09.md）；
 * - EP10：任务书与发布记录一致（memory/2026-10-19.md）；
 * - D01：制作包 00_使用说明与 06_发布标题与简介所载集名；
 * - 《银河系考勤管理局》：特别篇制作包名（女神的伊甸园/
 *   特别篇_银河考勤局_制作包_v1），YouTube 编号未定，留空待补。
 *
 * 播放源接口只有一个：presentEpisode()（见下）。v1 点播未开放
 * （播放要等公开托管），点选只把标题卡交给银幕；将来换源只动
 * 这一个函数，目录与面板两侧都不用改。
 */

export interface ComedyEpisode {
  /** 系列名（如「女神与伊甸园的蛇」「每日一笑」「宇宙官僚系列」）。 */
  series: string;
  /** 集号（如「EP01」「D01」「特别篇」）。 */
  episode: string;
  /** 发布主标题原文。 */
  title: string;
  /** YouTube 视频编号；null = 待补（馆内照常列目，只是不给外链）。 */
  youtubeId: string | null;
  /** 备注（如「现行修复版链接」「YouTube 编号待补」），可为空串。 */
  note: string;
}

export interface ComedyCatalog {
  version: number;
  episodes: ComedyEpisode[];
}

/** 目录取不到（离线/未托管）时的空目录：馆照常开，面板报空。 */
const EMPTY_CATALOG: ComedyCatalog = { version: 0, episodes: [] };

/**
 * 载入剧集目录（运行时 fetch 托管根下的 comedy-catalog.json）。
 * 形状不对或取不到一律返回空目录，不抛错打扰访客。
 */
export async function loadComedyCatalog(): Promise<ComedyCatalog> {
  try {
    const url = `${import.meta.env.BASE_URL}comedy-catalog.json`;
    const response = await fetch(url);
    if (!response.ok) return EMPTY_CATALOG;
    const parsed: unknown = await response.json();
    if (
      typeof parsed !== 'object' ||
      parsed == null ||
      !Array.isArray((parsed as { episodes?: unknown }).episodes)
    ) {
      return EMPTY_CATALOG;
    }
    const episodes: ComedyEpisode[] = [];
    for (const entry of (parsed as { episodes: unknown[] }).episodes) {
      if (typeof entry !== 'object' || entry == null) continue;
      const candidate = entry as Partial<ComedyEpisode>;
      if (
        typeof candidate.series !== 'string' ||
        typeof candidate.episode !== 'string' ||
        typeof candidate.title !== 'string'
      ) {
        continue;
      }
      episodes.push({
        series: candidate.series,
        episode: candidate.episode,
        title: candidate.title,
        youtubeId:
          typeof candidate.youtubeId === 'string'
            ? candidate.youtubeId
            : null,
        note: typeof candidate.note === 'string' ? candidate.note : '',
      });
    }
    const version = (parsed as { version?: unknown }).version;
    return {
      version: typeof version === 'number' ? version : 1,
      episodes,
    };
  } catch {
    return EMPTY_CATALOG;
  }
}

/** 该集的 YouTube 观看链接；编号待补时返回 undefined。 */
export function episodeWatchUrl(entry: ComedyEpisode): string | undefined {
  return entry.youtubeId == null
    ? undefined
    : `https://www.youtube.com/watch?v=${entry.youtubeId}`;
}

/**
 * 银幕把手：presentEpisode 只经这三个口跟银幕说话——标题卡文案
 * 与银幕微光。实现方是 comedy-catalog-system.ts（写 comedy-screen
 * 面板的元素 + 调银幕网格的 emissive）。
 */
export interface ComedyScreenHandle {
  /** 在银幕上亮出标题卡（主标题 / 系列·集号行 / 提示行）。 */
  showTitleCard(title: string, sub: string, note: string): void;
  /** 银幕微光增益（1 = 静息微光，>1 = 已选片的待播微亮）。 */
  setGlow(level: number): void;
}

/** 点播未开放时标题卡上的固定提示行（中英双语，园子体例）。 */
export const PLAYBACK_PENDING_NOTE =
  '园内点播将于公开托管后开放 · In-garden playback opens after public hosting.';

/**
 * ★ 播放源接口（扩展点，全馆唯一）★
 *
 * v1：没有播放源——把该集的标题卡交给银幕，微光略提亮，作
 * 「已选片、待开播」的读法；提示行写明点播待公开托管后开放。
 *
 * 将来公开托管后，点播只换这里：把 entry 对应的托管视频
 * （episodeWatchUrl 是外链口径；馆内播放用托管直链，届时在
 * 目录条目或本函数内换算）做成 VideoTexture，挂到银幕网格
 * （comedy-theater 资产内名为 comedy-screen 的网格）的材质上
 * 开始播放，并把 setGlow 换成播放态即可——目录数据、选集
 * 面板、系统三侧都不用再动。
 */
export function presentEpisode(
  entry: ComedyEpisode,
  screen: ComedyScreenHandle,
): void {
  const sub =
    entry.note.length > 0
      ? `${entry.series} · ${entry.episode} · ${entry.note}`
      : `${entry.series} · ${entry.episode}`;
  screen.showTitleCard(entry.title, sub, PLAYBACK_PENDING_NOTE);
  screen.setGlow(1.7);
}
