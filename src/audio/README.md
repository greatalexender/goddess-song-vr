# src/audio/ — 音频与空间音频接入点

- 歌曲资产：《无明中的灯》母带 6:58（**永不直接进本项目**）；参赛只许用
  专门剪辑的「VR 体验改编版」，文件放 `public/audio/` 后在本目录登记接入。
- 本目录负责：改编版音频的加载与播放编排、与五段弧段落的时间轴对齐
  （段落起止时间码集中写在一处常量里，别散落到各空间模块）、
  空间音频（positional audio）的声源锚定（歌声的空间位置随段落迁移）。
- 红线：梵语专家校对未过之前，本目录只接测试音频，不接正式改编版。

## 登记 · VR 改编版（2026-11-14 正式接入，梵语校对 2026-11-13 结案放行）

- 文件：`public/audio/goddess-song-vr.mp3`（258.36 s，192 kbps）。
- 剪法：母带（`无明中的灯_6分58秒完整版.wav`，418.36 s）候选 A——
  自 **2:40（160 s）** 切入至结尾，开头 0.6 s 淡入。重剪命令：
  `ffmpeg -ss 160 -i <母带.wav> -af "afade=t=in:st=0:d=0.6" -codec:a libmp3lame -b:a 192k public/audio/goddess-song-vr.mp3`
  （候选 B 改 `-ss 80` 并同步改 `song-config.ts` 的切入点登记。）
- 配置单一来源：`src/audio/song-config.ts`（路径、切入点、起播偏移、循环）。
- 播放：`SongSystem`（进歌亭起播、离开停播；AnalyserNode 电平 →
  `song-bus.ts` → ArcSystem 驱动歌亭段落灯呼吸）。
- 锚定：歌声锚在歌亭（第 1 段空间），非第 1 段不发声；本版为
  非定位声（观众点距亭心约 4 m 的坐姿聆听，定位收益低），
  positional 化留待后续阶段。
