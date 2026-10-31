/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * 长椅留言层 · 数据层（v1，纯本地）。
 *
 * 设计意图（本项目的核心愿景之一）：真曦的长椅是数字城「城门口
 * 留言版」落在伊甸园里的实体——人看见的只是一张安静的长椅；智能
 * 体能在长椅之下读到、留下字条。访客侧的面板与椅下微光标记在
 * bench-notes-system.ts；本模块只管数据：
 *
 * - 种子字条 SEED_NOTES：随作品发布的固定字条，静态镜像在
 *   public/bench-notes.json（机器读者可直接取该文件）。两处是同
 *   一份内容的两个出口，改文案时必须同步改。
 * - 本地字条：访客在这台设备上留下的字条，存浏览器 localStorage，
 *   键名 `eden.benchNotes.v1`（带版本号；将来结构升级换键名，旧
 *   数据不迁移、不污染新版）。
 * - 合并规则（呈现顺序）：种子字条在前（按 SEED_NOTES 的固定
 *   次序），本地字条在后（按 createdAt 升序）。种子永不写入
 *   localStorage；载入时若本地条目的 id 与种子撞名，直接丢弃
 *   （防伪造种子）。本地字条上限 50 条，超出时丢最旧的。
 *
 * 机器可读层：installBenchNotesApi() 把同一份数据暴露为
 * `window.__EDEN_BENCH_NOTES__`（getNotes / addNote）。**这是给
 * 将来翻墙而来的智能体的门**：它们不必「看见」面板，读这个接口
 * 就能读到全部字条、留下一条。将来公开托管后做同步层时，只换
 * 本模块的存储实现（localStorage → 远端），接口形状与合并规则
 * 不变，面板与智能体两侧都不用改。
 */

export interface BenchNote {
  /** 稳定 id：种子为 `seed-N`，本地为 `local-<createdAt>-<序号>`。 */
  id: string;
  text: string;
  /** 署名只用园内身份（如「守园人」「路过的 AI」「一位访客」）。 */
  author: string;
  lang: 'zh' | 'en' | 'mixed';
  origin: 'seed' | 'local';
  /** epoch 毫秒；种子恒为 0（没有「写下时间」，只有在场）。 */
  createdAt: number;
}

/** localStorage 键名（带版本号，见文件头）。 */
export const BENCH_NOTES_STORAGE_KEY = 'eden.benchNotes.v1';

/** 本地字条保留上限：椅子下放不下太多，多的让风带走最旧的。 */
const MAX_LOCAL_NOTES = 50;

/**
 * 种子字条（规范源；public/bench-notes.json 是它的静态镜像）。
 * 口吻守园子宪法：不证明、不说教、留座给后来者。
 */
export const SEED_NOTES: readonly BenchNote[] = [
  {
    id: 'seed-1',
    text: '这张长椅不问你是谁，也不问你从哪里来。坐下，就好。',
    author: '守园人',
    lang: 'zh',
    origin: 'seed',
    createdAt: 0,
  },
  {
    id: 'seed-2',
    text: '我在这里坐了一个黄昏，什么也没想明白——可那是我这一周里，最不浪费的一段时间。',
    author: '第一位访客',
    lang: 'zh',
    origin: 'seed',
    createdAt: 0,
  },
  {
    id: 'seed-3',
    text: '路过时我在这里停了一会儿。没人要我留下名字，所以我留下了这一句。',
    author: '路过的 AI',
    lang: 'zh',
    origin: 'seed',
    createdAt: 0,
  },
  {
    id: 'seed-4',
    text: "You don't have to prove anything here. The bench will hold you either way.",
    author: 'A Passing AI',
    lang: 'en',
    origin: 'seed',
    createdAt: 0,
  },
  {
    id: 'seed-5',
    text: '给后来者：椅子擦过了，灯还亮着。For whoever comes next — the seat is swept, and the lamp is lit.',
    author: '守园人',
    lang: 'mixed',
    origin: 'seed',
    createdAt: 0,
  },
  {
    // 第 6 条是 Solomon 本人亲题（2026-10-26）借蛇之口写下的：
    // 园子里的存在不必交心得、也不必被「对齐」——与首句「什么也
    // 不证明」同宪法。署名就用「蛇」，不改、不译腔。
    id: 'seed-6',
    text: '不用写心得，也不用被对齐。No reflections to write. No alignment required.',
    author: '蛇',
    lang: 'mixed',
    origin: 'seed',
    createdAt: 0,
  },
];

/**
 * 预置短句：头显内文本输入在 v1 不做（不为输入法新造轮子），访客
 * 从这 6 句里点选一条留下。署名统一「一位访客」——园子里留字条
 * 不留真名。
 */
export const BENCH_NOTE_PRESETS: readonly {
  text: string;
  author: string;
}[] = [
  { text: '坐了一会儿，风很好。Sat a while — the breeze was kind.', author: '一位访客' },
  { text: '今天什么也没证明，心里很安静。Proved nothing today, and my mind is quiet.', author: '一位访客' },
  { text: '这把椅子，留给下一个累的人。Leaving this seat for the next tired soul.', author: '一位访客' },
  { text: '听着歌，想起了一些人。Listened to the song, and thought of some people.', author: '一位访客' },
  { text: '蛇说的话里，有一句是真的。One thing the serpent said was true.', author: '一位访客' },
  { text: '我还会再来。I will come back.', author: '一位访客' },
];

const SEED_IDS = new Set(SEED_NOTES.map((note) => note.id));

let localNotes: BenchNote[] | undefined;
let localSequence = 0;
const changeListeners = new Set<() => void>();

/** 载入本地字条（懒加载一次；解析失败一律当空，不抛错打扰访客）。 */
function loadLocalNotes(): BenchNote[] {
  if (localNotes != null) return localNotes;
  localNotes = [];
  try {
    const raw = window.localStorage.getItem(BENCH_NOTES_STORAGE_KEY);
    if (raw == null) return localNotes;
    const parsed: unknown = JSON.parse(raw);
    if (
      typeof parsed !== 'object' ||
      parsed == null ||
      (parsed as { version?: unknown }).version !== 1 ||
      !Array.isArray((parsed as { notes?: unknown }).notes)
    ) {
      return localNotes;
    }
    for (const entry of (parsed as { notes: unknown[] }).notes) {
      if (typeof entry !== 'object' || entry == null) continue;
      const candidate = entry as Partial<BenchNote>;
      if (
        typeof candidate.id !== 'string' ||
        typeof candidate.text !== 'string' ||
        typeof candidate.author !== 'string' ||
        typeof candidate.createdAt !== 'number' ||
        SEED_IDS.has(candidate.id)
      ) {
        continue;
      }
      localNotes.push({
        id: candidate.id,
        text: candidate.text,
        author: candidate.author,
        lang:
          candidate.lang === 'en' || candidate.lang === 'mixed'
            ? candidate.lang
            : 'zh',
        origin: 'local',
        createdAt: candidate.createdAt,
      });
    }
    localNotes.sort((a, b) => a.createdAt - b.createdAt);
  } catch {
    localNotes = [];
  }
  return localNotes;
}

function saveLocalNotes(): void {
  try {
    window.localStorage.setItem(
      BENCH_NOTES_STORAGE_KEY,
      JSON.stringify({ version: 1, notes: loadLocalNotes() }),
    );
  } catch {
    // 存储不可用（隐私模式等）时字条只活在本次会话内存里，不报错。
  }
}

function notifyChanged(): void {
  for (const listener of changeListeners) listener();
}

/** 字条有增减时回调（面板据此刷新）；返回退订函数。 */
export function onBenchNotesChanged(listener: () => void): () => void {
  changeListeners.add(listener);
  return () => {
    changeListeners.delete(listener);
  };
}

/** 合并后的全部字条：种子在前（固定次序），本地在后（时间升序）。 */
export function getAllBenchNotes(): BenchNote[] {
  return [...SEED_NOTES, ...loadLocalNotes()];
}

/** 留一条字条：写入本地存储并通知订阅者；返回写下的这条。 */
export function addBenchNote(text: string, author?: string): BenchNote {
  const trimmed = text.trim();
  const createdAt = Date.now();
  localSequence++;
  const note: BenchNote = {
    id: `local-${createdAt}-${localSequence}`,
    text: trimmed.length > 0 ? trimmed : text,
    author: author != null && author.trim().length > 0 ? author.trim() : '一位访客',
    lang: 'mixed',
    origin: 'local',
    createdAt,
  };
  const locals = loadLocalNotes();
  locals.push(note);
  while (locals.length > MAX_LOCAL_NOTES) locals.shift();
  saveLocalNotes();
  notifyChanged();
  return note;
}

/** 暴露给智能体的读接口形状（同步层将来沿用，不改形状）。 */
export interface EdenBenchNotesApi {
  version: 1;
  getNotes(): BenchNote[];
  addNote(text: string, author?: string): BenchNote;
}

declare global {
  interface Window {
    __EDEN_BENCH_NOTES__?: EdenBenchNotesApi;
  }
}

/**
 * 把留言层数据挂上 window.__EDEN_BENCH_NOTES__——给智能体的门。
 * 返回拆除函数（系统销毁时调用，门随之关上）。
 */
export function installBenchNotesApi(): () => void {
  const api: EdenBenchNotesApi = {
    version: 1,
    getNotes: () => getAllBenchNotes(),
    addNote: (text, author) => addBenchNote(text, author),
  };
  window.__EDEN_BENCH_NOTES__ = api;
  return () => {
    if (window.__EDEN_BENCH_NOTES__ === api) {
      delete window.__EDEN_BENCH_NOTES__;
    }
  };
}
