# goddess-song-vr

**工作标题：The Goddess's Song (Lalita · A Lamp in the Darkness)**
——《女神之歌》VR 参赛作品（Meta VR Start Developer Competition 2026，Entertainment 赛道）

一句话形态：坐姿、手势与目光领路、以歌为路的沉浸式音乐体验。
体验者站在伊甸园花园里，面前一盏灯，听完整首《无明中的灯》。

设计依据：`goals/goal-4/files/女神之歌_VR体验设计稿_v0.1.md` 与
`女神之歌_VR参赛摸底报告_2026-10-26.md`（五段弧 → 五空间、门与红线都在里面）。

## 技术路线

- **Meta Immersive Web SDK (IWSDK) 官方脚手架** `npm create @iwsdk@latest`
（@iwsdk/create 1.1.0-rc.2，`--target vr --language ts`），运行时 @iwsdk/core 1.1.0-rc.2。
- 提交路线走 **IWSDK / WebXR**：免 APK、免发布频道，只交托管链接 +
3 分钟内演示视频 + 文字说明（评审在 Quest 3/3S 上经链接访问）。
- 场景构成走 IWSDK 原生方式：静态几何在 `src/scene-assets/*.scene-asset.ts`
以代码程序化生成，组合在 `public/scenes/*.iwsdk.scene.json`，
项目级开关（XR 模式、特性）以 `iwsdk.config.json` 为准。
- 环境（本机实测）：Node **v24.22.1**、npm **10.9.4**。

## 本地启动

```bash
cd ~/workspace/goals/goal-4/vr_project/goddess-song-vr
npm run dev # IWSDK CLI 托管的 dev server，不要直接跑 vite
```

- 地址：https://localhost:8081/（本地自签证书，浏览器/头显上需接受一次证书警告）。
- 关停：`npm run dev:down`；状态：`npm run dev:status`。
- 提交代码前先过类型检查：`npm run typecheck`。
- 无头显也能开发：入口页注入 IWER 浏览器 XR 模拟器；演示视频可用模拟器录制。
但正式参赛前必须真机（Quest 3S）验过一遍——这是本项目的执行纪律。

## 当前骨架（最小可进 VR 场景）

- `garden-ground`：半径 18 m 圆形草地（`LocomotionEnvironment` + `DomeFade` 边缘消隐）。
- `goddess-lamp`：0 号灯——细杆 + 暖色发光球（emissive）+ `PointLight`（暖黄、9 m、衰减 2），
立在玩家正前方 2 m。本作题眼就是这盏灯，后续五空间的灯都从它派生。
- 天空：关卡根 `DomeGradient` 黄昏紫 + `IBLGradient` 同色系环境光。
- 欢迎面板（`public/ui/welcome.uikitml`）：本作标题 + **Enter XR** 按钮
（`src/panel.ts` 的 PanelSystem 接 `world.launchXR()`），已挪到玩家右前方不挡灯。
- 特性开关：骨架期关掉了 locomotion 与 grabbing（坐姿静止体验），
后续按空间需要再开（改 `iwsdk.config.json` 的 `world.features`）。
- 实测渲染统计（骨架）：全场 5 个节点、**1666 个三角形**——离预算上限还很远。

## 性能预算纪律（目标：Quest 3S 稳定 60 fps）

- 以最弱评测机 Quest 3S 为性能靶，从第一天保守设计，不许先堆后优化。
- 低多边形：场景几何只用低段数基本体与程序化资产；单个空间三角形数以万计封顶，
每加一个空间先看 `renderStats.triangles` 再合入。
- 粒子限额：任何粒子系统单系统 ≤ 2,000 粒、总数设硬顶，写在常量里。
- 单场景加载：全程一个场景，段落切换靠同一场景内的编排，不做多场景跳转加载。
- 动态光源克制：骨架期仅 1 盏 PointLight + 1 盏 HemisphereLight、无影
（`environment.shadows: false`）；新增点光源须逐盏评审。
- `update()` 里不许分配对象（项目 AGENTS.md 的 ECS 纪律同样适用）。

## 目录结构

```
iwsdk.config.json 项目权威配置：场景、资产/组件清单、XR 与特性开关
index.html 入口页（标题、#scene-container、/src/index.ts）
src/index.ts World.create() + 系统登记（当前只有 PanelSystem）
src/panel.ts 欢迎面板的 Enter XR / Exit 按钮接线
src/assets.ts 资产清单（运行时与编辑器共用，保持确定性、无副作用）
src/components.ts 自定义组件登记（骨架期为空，后续在此登记）
src/scene-assets/ 程序化 3D 资产原型（garden.scene-asset.ts = 地面 + 灯）
src/spaces/ 五段弧 → 五空间的逻辑与段落编排（见其 README）
src/audio/ 歌曲改编版接入、段落时间轴、空间音频锚点（见其 README）
src/interaction/ 手势（摊手唤光/合掌归静）与注视互动（见其 README）
public/scenes/ 场景组合 JSON（main.iwsdk.scene.json）
public/ui/ UIKitML 面板（welcome.uikitml）
public/audio/ 音频文件（骨架期只有脚手架自带的 chime.mp3 占位）
```

## 资产红线（不可越）

- **母带 6:58 永不作参赛素材**，不进本项目、不上传任何托管。
- 参赛只许用专门剪辑的「VR 体验改编版」音频；改编版一旦提交即暴露于
官方规则第 9 节的永久宣传许可之下——是否参赛最终由 Solomon 拍板（已批 GO，见摸底报告）。
- 梵语专家校对是公开发布（含参赛提交）前置门：未过之前只接测试音频。

## 下一步清单

1. 五空间：在 `src/spaces/` 按段落逐个落模块（呼唤 → 回应 → 交融 → 内在之光 → 归于宁静），
每段的场景资产进 `src/scene-assets/` 并在场景 JSON 里编排。
2. 手势：在 `src/interaction/` 落摊手唤光（第 2 段）与合掌归静（第 5 段），
加开场 30 秒无文字手势教学；组件先声明再登记到 `src/components.ts`。
3. 空间音频：在 `src/audio/` 接改编版（校对过关后），段落时间码集中一处常量，
歌声的空间位置随段落迁移。
4. Horizon Start 成员审核通过后，按 Devpost 要求准备提交物：
托管链接 + 3 分钟内真实画面演示视频 + 文字说明；内控完工线 2026-11-14，
截止 2026-11-18 12:00 PT。
5. Quest 3S 到货后：真机帧率与手势手感验收（Solomon 试戴反馈），
再定是否需要 Quest 3 做第二测试机。

## 本机开发注意（踩过的坑）

- IWSDK 托管浏览器默认有头启动；无显示器的机器上会因缺 X Server 直接失败。
本机需先起虚拟显示再拉服务：`Xvfb:99 &` 后 `DISPLAY=:99 npm run dev`。
- 本机无 CJK 字体：编辑器/无头渲染里中文会呈方块（豆腐块），真机与正常浏览器有
CJK 字体则正常；面板正文后续可考虑中英双语或以英文为主。
- 首次 `dev up` 会下载 Playwright Chromium（约 120 MB），并用 SwiftShader 软件渲染。
