/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { createSystem } from '@iwsdk/core';
import {
  SONG_LOOP,
  SONG_PLAYBACK_OFFSET_SECONDS,
  SONG_VR_AUDIO_PATH,
} from './song-config.js';
import {
  registerSongControls,
  setSongLampLevel,
  setSongStatus,
  type SongStatus,
} from './song-bus.js';

/**
 * 《女神之歌》VR 改编版的播放编排（ src/audio/README.md 的接入点）。
 *
 * 第二批改版（2026-11-14）核心：**双保险 + 重试看门狗**，验收口径
 * 「确保一定有歌」。背景：第一批在 Quest 真机出现间歇性起播失败
 * （同构建上午成功、晚上无声）——旧实现把成败押在一次性调用上：
 * 解码/fetch 失败一次无人再触发、AudioContext 在纯注视进入（无
 * 用户手势）时可能永久 suspended。本版改为带重试的状态机：
 *
 * 第一重（点火）：Enter XR 的真实点击手势内经 song-bus 调
 * prime()——创建/resume AudioContext + 拉取并解码缓冲，静音待命，
 * 不等进亭才开始准备。页面首次 pointerdown、PWA 图标启动、
 * 系统 init 也各调一次 prime() 作预热（无手势时 context 可能仍
 * suspended，但解码可先行，缓冲就绪后只差一次 resume）。
 *
 * 第二重（进亭自动起播）：PavilionSystem 进第 1 段发
 * requestSongPlay()，与第一重相互独立——哪重先到位都能响：
 * 缓冲未就绪则状态机等它就绪，已 suspended 则持续 resume。
 *
 * 看门狗（兜底）：wantPlaying 期间 update() 持续巡检——context
 * 非 running 就节流 resume（XR select 发生时立即再试）、缓冲未
 * 就绪就按退避重试 fetch/解码（上限后转慢速长重试且状态置
 * error 供亭内面板亮提示）、源意外 ended 就重启。状态经
 * song-bus 发布（loading/playing/error），亭内面板据此显示
 * 「歌正在加载」或「若听不到歌，请捏合或按一下」，不许静默失败。
 *
 * 电平职责不变：AnalyserNode 测 RMS → 灯光增益经 song-bus 供
 * ArcSystem 驱动歌亭段落灯，只在第 1 段生效。歌曲循环播放
 * （SONG_LOOP），客人在亭内多久就唱多久。
 */

type LoadState = 'idle' | 'fetching' | 'decoding' | 'ready' | 'failed';

const MAX_FAST_ATTEMPTS = 3;
const FAST_RETRY_DELAYS = [0.5, 1.5, 4];
const SLOW_RETRY_DELAY = 15;
const RESUME_RETRY_INTERVAL = 0.3;

export class SongSystem extends createSystem({}) {
  private context: AudioContext | undefined;
  private analyser: AnalyserNode | undefined;
  private source: AudioBufferSourceNode | undefined;
  private buffer: AudioBuffer | undefined;
  private rawData: ArrayBuffer | undefined;

  private loadState: LoadState = 'idle';
  private fetchAttempts = 0;
  private decodeAttempts = 0;
  private retryTimer = 0;

  private wantPlaying = false;
  private playing = false;
  private status: SongStatus = 'idle';
  private smoothedGain = 1;
  private resumeAccumulator = 0;
  private readonly timeDomain = new Uint8Array(1024);

  init(): void {
    this.cleanupFuncs.push(
      registerSongControls({
        play: () => this.requestPlay(),
        stop: () => this.requestStop(),
        prime: () => this.prime(),
        isPlaying: () => this.playing,
      }),
    );
    // 页面从后台标签恢复（如经 Horizon App 分享链接切回浏览器）：
    // context 可能已被挂起，想播就重新点火。
    const onVisibility = () => {
      if (document.visibilityState === 'visible' && this.wantPlaying) {
        this.prime();
      }
    };
    document.addEventListener('visibilitychange', onVisibility);
    this.cleanupFuncs.push(() =>
      document.removeEventListener('visibilitychange', onVisibility),
    );
    // 页面上第一次真实点按（2D 欢迎板点按、画布点击）即预热：
    // 此刻有用户激活，context 能真正 running、解码能提前完成。
    const onFirstPointer = () => this.prime();
    window.addEventListener('pointerdown', onFirstPointer);
    this.cleanupFuncs.push(() =>
      window.removeEventListener('pointerdown', onFirstPointer),
    );
    // 启动即预热一次（PWA 图标启动路径没有 pointerdown 可等）。
    this.prime();
  }

  /**
   * 第一重点火：建图 → resume → 拉取/解码。可在任何时刻安全
   * 重复调用（幂等）；在真实手势内调用时 context 能当场 running。
   */
  private prime(): void {
    this.ensureContext();
    if (this.context != null && this.context.state !== 'running') {
      void this.context.resume().catch(() => {
        // 无用户激活时 resume 可能被拒：不报错，看门狗会再试。
      });
    }
    // 真手势点火不等退避：加载已失败时立即重置重试闸门。
    if (this.loadState === 'failed') {
      this.loadState = 'idle';
      this.retryTimer = 0;
    }
    this.ensureLoad();
  }

  private requestPlay(): void {
    this.wantPlaying = true;
    // 第二重独立成立：即便第一重从未点火，这里也完整走一遍。
    this.prime();
  }

  private requestStop(): void {
    this.wantPlaying = false;
    if (this.source != null) {
      try {
        this.source.stop();
      } catch {
        // 已停止的源重复 stop 会抛错，忽略。
      }
      this.source.disconnect();
      this.source = undefined;
    }
    this.playing = false;
    setSongLampLevel(null);
    this.syncStatus();
  }

  private ensureContext(): void {
    if (this.context != null) return;
    this.context = new AudioContext();
    this.analyser = this.context.createAnalyser();
    this.analyser.fftSize = 2048;
    this.analyser.connect(this.context.destination);
  }

  /**
   * 加载状态机：fetch（保留原始字节）→ decode（每次传副本，
   * decodeAudioData 会 detach 入参）。任一步失败都按退避重试，
   * 不再「失败一次定终身」。
   */
  private ensureLoad(): void {
    if (
      this.buffer != null ||
      this.loadState === 'fetching' ||
      this.loadState === 'decoding' ||
      this.loadState === 'ready'
    ) {
      return;
    }
    if (this.loadState === 'failed' && this.retryTimer > 0) return;
    if (this.rawData == null) {
      this.loadState = 'fetching';
      this.fetchAttempts += 1;
      const url = `${import.meta.env.BASE_URL}${SONG_VR_AUDIO_PATH}`;
      fetch(url)
        .then((response) => {
          if (!response.ok) throw new Error(`HTTP ${response.status}`);
          return response.arrayBuffer();
        })
        .then((data) => {
          this.rawData = data;
          this.loadState = 'idle';
          this.decodeAttempts = 0;
          this.ensureLoad();
        })
        .catch(() => {
          this.loadState = 'failed';
          this.retryTimer = this.nextRetryDelay(this.fetchAttempts);
          this.syncStatus();
        });
      return;
    }
    this.ensureContext();
    if (this.context == null) return;
    this.loadState = 'decoding';
    this.decodeAttempts += 1;
    this.context
      .decodeAudioData(this.rawData.slice(0))
      .then((decoded) => {
        this.buffer = decoded;
        this.loadState = 'ready';
        this.fetchAttempts = 0;
        this.decodeAttempts = 0;
        this.syncStatus();
      })
      .catch(() => {
        this.loadState = 'failed';
        this.retryTimer = this.nextRetryDelay(this.decodeAttempts);
        this.syncStatus();
      });
  }

  private nextRetryDelay(attempts: number): number {
    return attempts <= MAX_FAST_ATTEMPTS
      ? FAST_RETRY_DELAYS[Math.min(attempts - 1, FAST_RETRY_DELAYS.length - 1)]
      : SLOW_RETRY_DELAY;
  }

  private startSource(): boolean {
    if (
      this.context == null ||
      this.analyser == null ||
      this.buffer == null ||
      this.source != null
    ) {
      return this.source != null;
    }
    try {
      const source = this.context.createBufferSource();
      source.buffer = this.buffer;
      source.loop = SONG_LOOP;
      source.connect(this.analyser);
      source.onended = () => {
        if (this.source === source) {
          // 循环开启时本不应触发；万一源意外结束而客人还在亭内，
          // 清掉句柄让看门狗下一帧重启，不清 wantPlaying。
          this.source = undefined;
          this.playing = false;
          this.syncStatus();
        }
      };
      source.start(0, SONG_PLAYBACK_OFFSET_SECONDS);
      this.source = source;
      this.playing = true;
      this.syncStatus();
      return true;
    } catch {
      // start 抛错（如偏移越界）：句柄不落，看门狗下一帧再试。
      return false;
    }
  }

  /** 状态派生：变化时才经总线发布（亭内面板据此显隐提示行）。 */
  private syncStatus(): void {
    let next: SongStatus;
    if (this.playing) {
      next = 'playing';
    } else if (this.wantPlaying) {
      const exhausted =
        this.loadState === 'failed' &&
        Math.max(this.fetchAttempts, this.decodeAttempts) > MAX_FAST_ATTEMPTS;
      next = exhausted ? 'error' : 'loading';
    } else if (this.buffer != null) {
      next = 'ready';
    } else if (this.loadState === 'fetching' || this.loadState === 'decoding') {
      next = 'loading';
    } else {
      next = 'idle';
    }
    if (next !== this.status) {
      this.status = next;
      setSongStatus(next);
    }
  }

  update(delta: number): void {
    // XR select（扳机/捏合）兜底点火：无论是否想播，先把
    // context 与缓冲推到就绪——进亭那一刻不再从零开始。
    const selectStart =
      this.input.xr.getSelectState('left').start ||
      this.input.xr.getSelectState('right').start;
    if (selectStart) {
      this.prime();
      this.resumeAccumulator = RESUME_RETRY_INTERVAL;
    }

    if (!this.wantPlaying) {
      this.syncStatus();
      return;
    }

    // 看门狗一：加载失败按退避重试至就绪（慢速长重试不封顶）。
    if (this.loadState === 'failed') {
      this.retryTimer -= delta;
      if (this.retryTimer <= 0) {
        this.loadState = 'idle';
        this.ensureLoad();
      }
    } else {
      this.ensureLoad();
    }

    // 看门狗二：context 非 running 就持续 resume（节流 0.3 s，
    // select 当帧立即试）。Quest 从后台恢复常停在 suspended /
    // interrupted，一律按非 running 处理。
    if (this.context != null && this.context.state !== 'running') {
      this.resumeAccumulator += delta;
      if (this.resumeAccumulator >= RESUME_RETRY_INTERVAL) {
        this.resumeAccumulator = 0;
        void this.context.resume().catch(() => {});
      }
    }

    // 看门狗三：万事俱备仍未出声就起播（起播本身失败下帧再试）。
    if (
      !this.playing &&
      this.context?.state === 'running' &&
      this.buffer != null
    ) {
      this.startSource();
    }
    this.syncStatus();

    // 电平 → 灯光增益：RMS 映射到 0.86–1.31，平滑后经总线发布。
    if (this.playing && this.analyser != null) {
      this.analyser.getByteTimeDomainData(this.timeDomain);
      let sumSquares = 0;
      for (let i = 0; i < this.timeDomain.length; i++) {
        const v = (this.timeDomain[i] - 128) / 128;
        sumSquares += v * v;
      }
      const rms = Math.sqrt(sumSquares / this.timeDomain.length);
      const target = 0.86 + Math.min(rms * 1.5, 0.45);
      const blend = Math.min(1, delta * 6);
      this.smoothedGain += (target - this.smoothedGain) * blend;
      setSongLampLevel(this.smoothedGain);
    }
  }
}
