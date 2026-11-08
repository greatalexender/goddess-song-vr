# 中文字体图集再生成（Noto Sans SC 子集 MSDF）

面板中文走预生成的 BMFont MSDF 图集（`public/fonts/`），不走运行时
TTF 生成——@pmndrs/uikit 的 TTFLoader 字符集写死 ASCII，生成不出
中文字形。**向 bench-notes.json / comedy-catalog.json / 面板文案里
新增中文后，必须重跑本流程**，否则新字渲染成白方块。

产物（提交进仓库）：
- `public/fonts/noto-sans-sc-{regular,bold}.json` + `.webp`：图集
- `public/fonts/noto-sans-sc-{regular,bold}.ttf`：子集 TTF（面板
  @font-face 声明的校验与装配占位，运行时由 CjkFontSystem 覆盖为
  上面的 JSON 图集）
- `public/fonts/OFL.txt`：Noto Sans SC 的 SIL OFL 1.1 许可

步骤（在本机一次性工具目录里做，工具不进仓库）：

1. 提取字符集：扫描 `public/ui/*.uikitml`、`public/bench-notes.json`、
   `public/comedy-catalog.json`、`src/spaces/{bench-notes,comedy-catalog}{,-system}.ts`
   的全部非拉丁字符，另加常用标点符号与 ASCII 可打印区，写入
   `scripts/cjk-charset.txt`（当前 756 字）。
2. 下载 Noto Sans SC 静态 TTF（400/700，Google Fonts），用 fonttools
   子集化：`python3 -m fontTools.subset <ttf> --text-file=scripts/cjk-charset.txt
   --layout-features='*' --no-hinting`。
3. 用 msdf-bmfont-xml（npm）生成图集：
   `npx msdf-bmfont -f json -o noto-sans-sc-regular -s 48 -r 4 -t msdf
   -i scripts/cjk-charset.txt <subset.ttf>`（bold 同理）。
4. PNG 转 WebP 无损；JSON 里 `pages` 改指 `.webp`、`info.face` 改为
   `Noto Sans SC`、压缩空白后放回 `public/fonts/`。
5. `npm run build` 后按发布流程部署，并在桌面端截图复验中文面板。
