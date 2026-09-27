# 第三方组件与资料

根目录的 MIT 许可证覆盖 CPractice 原创部分，不修改下列组件的授权条款。分发源码或应用时，应一并保留 `ThirdParty/` 中的许可证；构建脚本会把该目录复制到应用资源中。

| 组件 | 使用位置与作用 | 随附许可文件 |
| --- | --- | --- |
| Monaco Editor | 代码编辑、语法高亮与编辑操作 | [MIT](ThirdParty/Monaco-LICENSE.txt)、[第三方通知](ThirdParty/Monaco-ThirdPartyNotices.txt) |
| Marked | Markdown 解析 | [MIT](ThirdParty/Marked-LICENSE.txt) |
| DOMPurify | 对生成的 HTML 进行净化 | [Apache 2.0](ThirdParty/DOMPurify-LICENSE.txt) |
| KaTeX | 数学公式与随附字体渲染 | [MIT](ThirdParty/KaTeX-LICENSE.txt) |

DOMPurify 的上游版本提供 Apache 2.0 / MPL 2.0 许可选择；本项目随附 Apache 2.0 文本。保留资源文件中的原有版权头与许可证说明，不要用本项目许可覆盖它们。

编辑器的构建依赖以 `Editor/package-lock.json` 为准；Markdown、HTML 净化及公式渲染依赖以 `Vendor/package-lock.json` 为准。更新依赖或新增资源时，请核对对应版本的许可证与传递依赖通知，再更新本文件及应用内致谢。

教程与出题方式参考的资料记录在 `Resources/acknowledgements.json` 和 `Resources/foundations-v5.json`。中文解释、生活化例子和题面由本项目独立编写；外部网页及其代码示例不会因被列为参考来源而自动改用 MIT 许可。

Codex、Clang、clangd、clang-format、VS Code 及用户自行安装的扩展均属于外部工具。本项目的许可不授予这些工具、产品名称、商标或服务的额外权利。应用内 Monaco 不承载完整 VS Code 扩展宿主；通过 VS Code 接入使用的是本机真实安装。

## 6.0 跨平台桌面依赖

- Electron 44.4.5：[MIT](ThirdParty/Electron-LICENSE.txt)；二进制含Chromium、Node.js等组件，打包产物保留其LICENSE和LICENSES.chromium.html。参见https://github.com/electron/electron。
- electron-builder 26.15.3：MIT，仅用于构建，参见https://github.com/electron-userland/electron-builder。
- Ajv 8.20.0：[MIT](ThirdParty/Ajv-LICENSE.txt)，用于验证模型输出Schema，参见https://github.com/ajv-validator/ajv。
- MSYS2/GCC/LLVM：用户自行安装的外部工具，未把工具链捆绑进源码或应用；它们各自的许可证继续适用。

根目录package-lock.json固定完整依赖树，node_modules不提交。所有实际分发的运行时依赖保留原LICENSE。
