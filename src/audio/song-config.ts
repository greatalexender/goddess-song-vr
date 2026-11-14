/**
 * 《女神之歌》VR 改编版 · 接入配置（单一事实来源）。
 *
 * 母带《无明中的灯》6:58 完整版（418.36 s）**永不直接进本项目**
 * （红线见 src/audio/README.md）；园中只放专门剪辑的 VR 改编版：
 *
 * - 当前工作剪 = 候选 A：自母带 **2:40（160 s）** 切入至结尾——
 *   2:25–2:40 是全曲唯一的结构性呼吸断点，2:40 起第一秒即全能量
 *   吟唱（能量分析见 goals/goal-4/files/女神之歌_VR第一剪_能量分析
 *   _2026-11-13.md）。文件 public/audio/goddess-song-vr.mp3，
 *   258.36 s，192 kbps MP3，开头加 0.6 s 淡入防爆音。
 * - 候选 B = 自 1:20（80 s）切入。复测若改选 B，只需按 README 的
 *   命令重剪音频文件并把 SONG_CUT_LABEL 改为 'B'，代码不动。
 * - 梵语校对已于 2026-11-13 结案放行，本改编版为正式接入。
 */

/** 改编版音频的站内路径（相对 BASE_URL）。 */
export const SONG_VR_AUDIO_PATH = 'audio/goddess-song-vr.mp3';

/** 本文件在母带中的切入点（秒）：候选 A = 160（2:40）；候选 B = 80（1:20）。 */
export const SONG_CUT_START_SECONDS = 160;

/** 当前工作剪标签（'A' | 'B'），仅作登记与日志用。 */
export const SONG_CUT_LABEL = 'A';

/** 文件内起播偏移（秒）：文件已按切入点预剪，默认从头播。 */
export const SONG_PLAYBACK_OFFSET_SECONDS = 0;

/** 播完是否循环：听完整首即止，不循环。 */
export const SONG_LOOP = false;
