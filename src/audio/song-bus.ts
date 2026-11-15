/**
 * 歌曲播放的模块级总线：SongSystem 在 init 时把自己登记为驱动方，
 * PavilionSystem 经此处发播放/停止请求，ArcSystem 经此处读当前
 * 音频电平（灯光增益语义，见 spaces.ts 的 applySpaceLampAudioLevel）。
 *
 * 没有驱动登记时（如编辑器预览）请求为空操作、电平为 null，
 * ArcSystem 自动回落到正弦呼吸测试曲线。
 */

export interface SongControls {
  play(): void;
  stop(): void;
  /** 点火：在真实用户手势内创建/resume AudioContext 并预热解码。 */
  prime(): void;
  isPlaying(): boolean;
}

/**
 * 播放状态（供亭内面板显示加载/失败提示，不许静默失败）：
 * idle 未点火；loading 已点火或想播但未出声（加载/解码/待 resume）；
 * ready 已解码待命；playing 正在出声；error 重试耗尽仍未出声。
 */
export type SongStatus = 'idle' | 'loading' | 'ready' | 'playing' | 'error';

let controls: SongControls | undefined;
let lampLevel: number | null = null;
let songStatus: SongStatus = 'idle';

export function registerSongControls(
  next: SongControls,
): () => void {
  controls = next;
  return () => {
    if (controls === next) controls = undefined;
  };
}

/** 点火请求：Enter XR 点击、页面首次 pointerdown、XR select 兜底均经此处。 */
export function primeSongAudio(): void {
  controls?.prime();
}

export function requestSongPlay(): void {
  controls?.play();
}

export function requestSongStop(): void {
  controls?.stop();
}

export function isSongPlaying(): boolean {
  return controls?.isPlaying() ?? false;
}

/** SongSystem 每帧写入平滑后的灯光增益；停止/无声时写 null。 */
export function setSongLampLevel(level: number | null): void {
  lampLevel = level;
}

/** ArcSystem 读取：null 表示当前无真实音频电平可用。 */
export function getSongLampLevel(): number | null {
  return lampLevel;
}

/** SongSystem 在状态变化时写入；PavilionSystem 读它驱动亭内提示行。 */
export function setSongStatus(status: SongStatus): void {
  songStatus = status;
}

export function getSongStatus(): SongStatus {
  return songStatus;
}
