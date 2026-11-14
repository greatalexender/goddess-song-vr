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
  isPlaying(): boolean;
}

let controls: SongControls | undefined;
let lampLevel: number | null = null;

export function registerSongControls(
  next: SongControls,
): () => void {
  controls = next;
  return () => {
    if (controls === next) controls = undefined;
  };
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
