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
import { registerSongControls, setSongLampLevel } from './song-bus.js';

/**
 * 《女神之歌》VR 改编版的播放编排（ src/audio/README.md 的接入点）。
 *
 * 职责只有三件：
 * 1. 懒加载并解码改编版音频（public/audio/goddess-song-vr.mp3，
 *    配置见 song-config.ts），应 PavilionSystem 的请求起播/停播；
 * 2. 用 AnalyserNode 实时测声压 RMS，映射成灯光增益（1 = 基准，
 *    语义与 spaces.ts 的 applySpaceLampAudioLevel 一致），经
 *    song-bus 供 ArcSystem 驱动歌亭段落灯——替换原来的正弦
 *    测试曲线，只在第 1 段（歌亭）生效；
 * 3. 自动播放策略兜底：AudioContext 若被浏览器挂起，在 XR
 *    select（扳机/捏合）发生时与每 0.3 s 重试 resume()，直到
 *    真正出声为止——进亭动作本身即手势，不另要求访客操作。
 *
 * 播放状态由 PavilionSystem 按段落进出驱动：进歌亭 requestSongPlay，
 * 离开 requestSongStop。歌播完自然停（不循环，见配置）。
 */
export class SongSystem extends createSystem({}) {
  private context: AudioContext | undefined;
  private analyser: AnalyserNode | undefined;
  private source: AudioBufferSourceNode | undefined;
  private buffer: AudioBuffer | undefined;
  private loadStarted = false;
  private wantPlaying = false;
  private playing = false;
  private smoothedGain = 1;
  private resumeAccumulator = 0;
  private readonly timeDomain = new Uint8Array(1024);

  init(): void {
    this.cleanupFuncs.push(
      registerSongControls({
        play: () => this.requestPlay(),
        stop: () => this.requestStop(),
        isPlaying: () => this.playing,
      }),
    );
  }

  private requestPlay(): void {
    this.wantPlaying = true;
    this.ensureGraph();
    if (this.context?.state === 'suspended') {
      void this.context.resume();
    }
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
  }

  /** 建 Web Audio 图：源 → AnalyserNode → 输出。解码只做一次。 */
  private ensureGraph(): void {
    if (this.context == null) {
      this.context = new AudioContext();
      this.analyser = this.context.createAnalyser();
      this.analyser.fftSize = 2048;
      this.analyser.connect(this.context.destination);
    }
    if (this.buffer != null || this.loadStarted) return;
    this.loadStarted = true;
    const url = `${import.meta.env.BASE_URL}${SONG_VR_AUDIO_PATH}`;
    fetch(url)
      .then((response) => response.arrayBuffer())
      .then((data) => this.context?.decodeAudioData(data))
      .then((decoded) => {
        if (decoded != null) this.buffer = decoded;
      })
      .catch(() => {
        // 解码/加载失败：保持静默，灯光继续走正弦呼吸，不崩溃。
        this.loadStarted = false;
      });
  }

  private startSource(): void {
    if (
      this.context == null ||
      this.analyser == null ||
      this.buffer == null ||
      this.source != null
    ) {
      return;
    }
    const source = this.context.createBufferSource();
    source.buffer = this.buffer;
    source.loop = SONG_LOOP;
    source.connect(this.analyser);
    source.onended = () => {
      if (this.source === source) {
        this.source = undefined;
        this.playing = false;
        this.wantPlaying = false;
        setSongLampLevel(null);
      }
    };
    source.start(0, SONG_PLAYBACK_OFFSET_SECONDS);
    this.source = source;
    this.playing = true;
  }

  update(delta: number): void {
    if (!this.wantPlaying) return;

    // 挂起恢复：select 手势或节流重试，任一成功即起播。
    if (this.context?.state === 'suspended') {
      const selectStart =
        this.input.xr.getSelectState('left').start ||
        this.input.xr.getSelectState('right').start;
      this.resumeAccumulator += delta;
      if (selectStart || this.resumeAccumulator >= 0.3) {
        this.resumeAccumulator = 0;
        void this.context.resume();
      }
    }
    if (
      this.playing === false &&
      this.context?.state === 'running' &&
      this.buffer != null
    ) {
      this.startSource();
    }

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
