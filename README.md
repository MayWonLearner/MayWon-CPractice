# MayWon CPractice · C 语言练习室

**从第一行 C 代码到算法综合题，把学习、编写、验证和复盘放在同一个桌面应用中。**

面向中文零基础学习者，支持 **Windows、macOS（Apple Silicon / Intel）和 Linux**。教程与题库随应用提供，可离线学习和本地评测；AI 功能通过你自己登录的 Codex 按需使用。

A cross-platform C learning desktop app with beginner-friendly lessons, 650 exercises, a Monaco editor, local judging, annotations and an optional AI tutor. The learning content is currently in Chinese.

[下载版本](https://github.com/MayWonLearner/MayWon-CPractice/releases) · [报告问题](https://github.com/MayWonLearner/MayWon-CPractice/issues) · [安装与使用](#安装) · [来源与致谢](#来源与致谢)

## 功能

| 板块 | 内容 |
|---|---|
| 完整教程 | 15章、76课，另有66个基础点细讲；小白生活例子与专业机制双层解释，术语对照、常见误解、伪代码、多行C程序、默认隐藏的理解题答案。 |
| 分级题库 | 300道章节练习（每章20题）+200道经典综合题+50道足球/篮球题+100道竞赛困难题，共650题。 |
| 代码工作台 | Monaco编辑器，语法着色、Enter自动缩进、补全、格式化、查找、`.c`导入/导出、VS Code工作区往返；安装clangd后提供语义诊断、跳转与重命名。 |
| 本地验证 | C17编译、标准输入、自定义运行、逐检查点评测、文件输入输出题、中文错误解释、时间和输出限制、取消运行。 |
| 具体错误分析 | GPT-5.6-Sol Medium分析当前代码、失败输入和问题行；悬浮显示可替换代码、逐行中文`//`注释、修改理由和复习引用。不会自动覆盖草稿。 |
| 定向错题本 | 根据具体错误或严重复杂度问题生成新的完整程序题；含严格题面、约束、样例说明、解法、复杂度和命题自查，参考程序通过本机检查点后才入库。 |
| 教程笔记 | 选中文本高亮、划线、写笔记，关闭后点击标记重开；可向High模型提问，回答在正文旁侧或窄屏段落后展示。 |
| C语言导师 | High模型文字/照片问答，支持点击选择和拖入图片，Markdown、LaTeX、C代码、分轮对话与引用追问。 |
| 存档 | 自动整理问答摘要并保存完整对话；多选置顶/删除、彩色置顶标识、选段批注、在同一存档继续追问。 |
| 学习反馈 | 多维能力视图、按章节分色的掌握度/遗忘/复习曲线、薄弱点推荐。未学习章节从0开始；曲线是辅助估计，不是医学或心理测量。 |
| 数据迁移 | 草稿和进度自动本地保存；可导出备份并在不同系统导入，恢复前自动保留当前记录。 |

完整教程可从左侧章节、主页学习路径或独立教程页直接进入；练习页教程不会覆盖代码编辑器。算法题强调时间与空间复杂度，区分额外空间和输入存储。

## 支持范围

| 平台 | 环境 | C工具链 |
|---|---|---|
| Windows | Windows 10/11，x64 | MSYS2 UCRT64 GCC；可选clangd/clang-format/gdb |
| macOS | macOS 13+，Apple Silicon或Intel | Apple Command Line Tools；可选Homebrew LLVM |
| Linux | Ubuntu 22.04/24.04 x64；其他现代发行版可从源码构建 | GCC/Clang；可选clangd/clang-format |

Windows ARM设备可尝试x64兼容运行；没有把未实测的原生ARM工具链列为正式验证平台。手机、平板及纯浏览器目前不提供本地C编译版。页面布局支持缩放和较小桌面窗口，快捷键按系统显示。

## 安装

### 方式一：下载桌面包

在 [Releases](https://github.com/MayWonLearner/MayWon-CPractice/releases) 选择对应平台与架构：Windows安装器/ZIP、macOS ZIP、Linux AppImage/TAR。安装编译工具后即可练习；**运行桌面包不需要安装Node.js**，使用Codex CLI时需按其官方要求安装。

目前发布构建没有付费平台签名/Apple公证。请核对发布来源和校验值；如系统阻止打开，可采用以下源码安装方式。不要关闭系统安全保护。

### 方式二：在终端从源码安装

这些命令不会要求你提供API密钥，也不会把本机学习数据上传到仓库。需要Git、Node.js **22或更新版本**及本机C编译器；初次下载依赖需联网。先关闭正在运行的旧版应用。

#### Windows：PowerShell

首次安装依赖（系统弹出的安装许可由你确认）：

```powershell
winget install --id Git.Git -e --source winget
winget install --id OpenJS.NodeJS.LTS -e --source winget
winget install --id MSYS2.MSYS2 -e --source winget
```

关闭并重新打开PowerShell，使Git和Node进入PATH。以下假设MSYS2安装到默认的`C:\msys64`，自定义安装位置时修改`$msys`：

```powershell
$msys = 'C:\msys64'
& "$msys\usr\bin\bash.exe" -lc 'pacman -Syu'
# 若上一步提示关闭终端以完成核心更新，关闭后重新打开，再执行下一行。
& "$msys\usr\bin\bash.exe" -lc 'pacman -S --needed mingw-w64-ucrt-x86_64-gcc mingw-w64-ucrt-x86_64-clang-tools-extra mingw-w64-ucrt-x86_64-gdb'

git clone https://github.com/MayWonLearner/MayWon-CPractice.git
cd MayWon-CPractice
npm.cmd ci
npm.cmd run doctor
npm.cmd run pack
node scripts/install.cjs
& "$env:LOCALAPPDATA\Programs\CPractice\CPractice.exe"
```

使用`npm.cmd`可避免PowerShell将同名`npm.ps1`误判为受限脚本，不需要修改执行策略。默认MSYS2目录会自动识别；自定义路径可先设置当前终端的`$env:PATH = "$msys\ucrt64\bin;$env:PATH"`。安装脚本会创建桌面快捷方式，应用数据保存在`%APPDATA%\CPractice Desktop`。

#### macOS：终端

安装Apple编译工具，等待系统安装窗口完成后继续：

```sh
xcode-select --install
```

安装Node.js 22+：可从 [Node.js官网](https://nodejs.org/en/download) 安装LTS版，或在已有Homebrew时执行 `brew install node`。随后：

```sh
git clone https://github.com/MayWonLearner/MayWon-CPractice.git
cd MayWon-CPractice
npm ci
npm run doctor
npm run pack
node scripts/install.cjs
open "$HOME/Applications/CPractice.app"
```

自动按当前芯片生成并安装，Intel与Apple Silicon无需手动修改源代码。安装到个人`~/Applications`，无需管理员权限。首次运行桌面版时会复制旧Swift版的学习记录，原文件保持不变；之后两版记录各自独立，可通过备份迁移。

仍需旧版轻量Swift外壳时，可使用：

```sh
bash scripts/build.sh ./dist/CPractice-Native.app
open ./dist/CPractice-Native.app
```

Swift外壳保留5.x原有功能，跨平台新增的备份导入与环境检测请使用6.x桌面版。

#### Linux：Ubuntu / Debian终端

```sh
sudo apt-get update
sudo apt-get install -y git build-essential clang clangd clang-format libgtk-3-0 libnss3 libasound2t64 libgbm1
# 安装Node.js 22+，按 https://nodejs.org/en/download 的当前说明操作。
git clone https://github.com/MayWonLearner/MayWon-CPractice.git
cd MayWon-CPractice
npm ci
npm run doctor
npm run pack
node scripts/install.cjs
"$HOME/.local/opt/cpractice/cpractice"
```

较旧发行版的ALSA包名可能是`libasound2`。Ubuntu 24.04的AppArmor可能限制从未安装目录启动Electron；请使用正式桌面包并按发行版文档配置应用权限，不要用`--no-sandbox`关闭浏览器沙盒。Linux安装脚本会创建应用菜单入口。

### 更新

在最初克隆的目录执行：

```sh
git pull --ff-only
npm ci
npm run pack
node scripts/install.cjs
```

Windows用`npm.cmd`替代`npm`。学习数据与安装目录分开；更新不会清除草稿。安装脚本把旧应用保留为`.previous-时间戳`，确认新版正常后可自行删除该旧应用副本。

## 使用

1. **先学**：进入左侧章节，阅读双层教程和基础点细讲。先回答理解题，再展开答案。
2. **动手写**：进入本章练习，自己写C程序，也可导入`.c`文件。
3. **运行与检查**：在“标准输入”填写数据，先运行观察，再检查全部检查点。不要在输出中额外打印题目未要求的提示语。
4. **具体复盘**：运行失败时查看中文诊断；需要模型深入讲解时点击“详细分析”。修改代码后旧分析会注明待复核，再次分析才产生新结论。
5. **巩固**：在错题本练习新生成题，查看复杂度及边界；原题和原草稿保留。
6. **提问与存档**：C语言导师支持文字或仅照片，回答后到存档回看，选中原话可引用追问。
7. **换电脑**：提交记录页“导出学习记录”；新电脑同页“导入备份/跨系统迁移”。导入会覆盖当前记录，并先自动备份当前内容。

| 操作 | macOS | Windows / Linux |
|---|---|---|
| 运行 | ⌘ Enter | Ctrl Enter |
| 检查全部 | ⌘ Shift Enter | Ctrl Shift Enter |
| 保存草稿 | ⌘ S | Ctrl S |
| 导入C文件 | ⌘ O | Ctrl O |
| 查找 | ⌘ F | Ctrl F |
| 界面缩放 | ⌘ + / − | Ctrl + / − |

VS Code是可选外部工具。安装后在VS Code终端执行 `code --install-extension llvm-vs-code-extensions.vscode-clangd`；Windows调试可安装`ms-vscode.cpptools`，macOS/Linux调试可安装`vadimcn.vscode-lldb`。应用生成匹配系统的编译/调试配置。内置Monaco无需安装VS Code插件即可使用；它不是可运行任意VS Code扩展的完整宿主。

## 连接自己的 Codex

在终端安装并登录官方CLI，然后打开应用“连接Codex”检测：

```sh
npm install -g @openai/codex
codex login
```

Windows可使用`npm.cmd`与`codex.cmd`。也可点击应用的“使用ChatGPT登录”，在官方页面由本人完成设备认证。不要把密码或令牌发给维护者。

| 功能 | 默认模型 | 推理强度 |
|---|---|---|
| 当前代码详细分析 | `gpt-5.6-sol` | Medium |
| 教程选段问答、C语言导师、定向出题 | `gpt-5.6-sol` | High |

**是否可用取决于账号的模型权限和额度**，不保证任意GPT套餐都可调用指定模型。CLI或模型不可用时会明确报错，不会切换模型或用模板冒充AI回答。更新CLI的命令与安装相同。

应用搜索PATH、常见包管理器及Node安装位置。自定义路径可以设置`CPRACTICE_CODEX`、`CPRACTICE_CLANG`、`CPRACTICE_GCC`、`CPRACTICE_CLANGD`、`CPRACTICE_CLANG_FORMAT`或`CPRACTICE_CODE`为工具的完整路径；随后从该终端启动应用。可在“连接Codex”检测编译/编辑环境，或运行`npm run doctor`。

## 数据、隐私与执行边界

- 数据目录：macOS `~/Library/Application Support/CPractice Desktop`；Windows `%APPDATA%\CPractice Desktop`；Linux通常为`~/.config/CPractice Desktop`。
- 默认只存本机；没有应用账号、云端同步或自动GitHub上传。备份含代码、笔记、对话和照片，请自行妥善保存。
- 仅在请求AI时，相关代码、题面、诊断、引用、对话及所选照片发送至本机已登录的Codex服务。
- macOS编译运行使用系统进程沙盒；Windows使用Job Object限制CPU、内存及进程树；Linux使用资源/时间/输出限制。**Windows/Linux当前不隔离文件系统和网络**，本地评测不是多用户在线判题沙盒，只运行自己编写或信任的C代码。
- 通过检查点不等于证明所有输入正确。AI讲解与自动命题仍需核对，尤其是边界和复杂度。

## 开发、测试与打包

```sh
npm ci
npm test
npm run test:legacy
npm run smoke
npm run dist
```

`npm test`包含真实C编译、15章代表题、文件题、错误状态、取消、输出限制、跨平台换行与存档测试。`npm run smoke`在隔离临时数据中检查窗口、Monaco、教程、公式渲染及真实IPC判题，不调用AI，完成后删除测试记录。

GitHub Actions分别在Windows、macOS ARM/Intel和Ubuntu运行测试与构建。远程状态以 [Actions](https://github.com/MayWonLearner/MayWon-CPractice/actions) 的实际结果为准；CI不使用个人Codex账号。

编辑器与数学渲染的资源已随仓库提供。如修改其源码，分别运行`cd Editor && npm ci && node build.mjs`或`cd Vendor && npm ci`后回根目录运行`node scripts/build-vendor.mjs`。

```text
Desktop/       跨平台桌面外壳、编译评测、Codex、语言服务、数据保存
Sources/       保留的macOS Swift实现及POSIX资源限制器
Resources/     离线课程、题库、页面、编辑器、模型Prompt与Schema
Editor/        Monaco集成源码与锁定依赖
Vendor/        Markdown/公式资源构建依赖
ThirdParty/    第三方许可证与通知
scripts/       构建、安装、环境检测与发布脚本
tests/         合成回归测试，不含私人数据
```

## 来源与致谢

课程、题目与中文说明独立编写。以下资料帮助组织教学路线、核对C规则或参考竞赛题面结构；**不是转载授权，也不表示官方合作或背书**。

- [Harvard CS50](https://cs50.harvard.edu/x/)：C、数组、内存与算法课程路线。
- [Beej’s Guide to C](https://beej.us/guide/bgc/) 和 [GNU C Manual](https://www.gnu.org/software/c-intro-and-ref/manual/)：语言机制与系统学习参考。
- [WG14公开文档](https://www.open-std.org/jtc1/sc22/wg14/) 和 [SEI CERT C](https://wiki.sei.cmu.edu/confluence/display/c/)：标准语义、输入边界、EOF和内存使用核查。
- [廖雪峰教程](https://liaoxuefeng.com/books/python/introduction/index.html)：仅参考由具体例子逐步解释的教学组织，不作为C语义来源，不复制其文字。
- [Exercism C](https://exercism.org/tracks/c)、[LeetCode](https://leetcode.com/studyplan/)、[IOI](https://ioinformatics.org/)：分级训练、题面规范和算法挑战的组织参考。
- [Electron](https://www.electronjs.org/)、[Monaco Editor](https://microsoft.github.io/monaco-editor/)、[LLVM/Clang](https://clang.llvm.org/)、[MSYS2](https://www.msys2.org/)、[GCC](https://gcc.gnu.org/)：桌面、编辑器与本地编译基础。
- Marked、DOMPurify、KaTeX、Ajv：Markdown、HTML净化、公式渲染与结构验证。
- [Codex CLI](https://developers.openai.com/codex/cli/)：使用用户自身登录的可选AI能力；认证说明见[官方文档](https://developers.openai.com/codex/auth/)。

更详细的逐项来源、参考性质和版本见应用内“来源与致谢”、`Resources/acknowledgements.json`与 [THIRD_PARTY.md](THIRD_PARTY.md)。

## 联系、贡献与许可

维护者：[MayWonLearner](https://github.com/MayWonLearner)。目前使用 [GitHub Issues](https://github.com/MayWonLearner/MayWon-CPractice/issues) 作为公开联系入口，未公开私人邮箱。

欢迎提交教程勘误、题面歧义、最小复现和跨平台兼容问题。参见 [CONTRIBUTING.md](CONTRIBUTING.md)、[SECURITY.md](SECURITY.md) 与 [RELEASE.md](RELEASE.md)。

原创代码、教程与题目采用 [MIT License](LICENSE)。第三方内容按各自许可证授权；MIT不替代第三方许可。本项目与OpenAI、Microsoft、LeetCode及引用作者没有官方隶属关系。
