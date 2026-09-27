# CPractice 6.0.1 · 跨平台桌面版

新增Electron桌面运行层，共用650题、76课、66基础点与全部学习界面。保留macOS Swift外壳，支持从源码分别构建。

6.0.1 修正个人目录安装时的内部符号链接复制。安装后的 Mac 应用不再依赖原构建目录；新增删除原始目录后仍可读取框架文件的回归测试。

## 本次变化

- Windows C17编译、评测、文件题、Job Object运行限制与UTF-8路径。
- macOS ARM/Intel与Linux桌面构建，按系统发现编译器、clangd、格式化、Codex和VS Code。
- 保留Medium行级复盘、High选段/照片/存档问答与针对性练习；同类请求可取消，不共享进程。
- Node/npm安装位置与Windows `.cmd`启动适配；学习代码和模型Prompt不经shell插值。
- 快捷键提示随系统变化，提供环境检测、个人目录安装、备份导入与跨系统迁移。
- 完整README、联系方式、致谢、MIT、`.gitignore`、多平台CI及安装步骤。

## 维护者发布

```sh
npm ci
npm test
npm run test:legacy
npm run smoke
npm run dist
```

Windows和Linux构建应在相应系统完成。根目录`package.json`的electron-builder配置列出发布目标与架构；CI上传的构建产物可供下载，是否通过以实际Actions运行结果为准。

源代码必须通过`scripts/prepare-release.py --audit-only`检查，使用Git跟踪的白名单导出，不从整个工作目录递归压缩：

```sh
python3 scripts/prepare-release.py --audit-only
python3 scripts/prepare-release.py --output ../CPractice-6.0.1-source.zip
```

源包不得含学习记录、照片、模型原始输出、认证文件、构建缓存或`node_modules`。运行时仍应携带Electron及第三方依赖原许可证。源码引用资料不等于拥有被引用网页的转载权。

## 适用与验证边界

macOS原生系统沙盒与Windows/Linux资源限制的强度不同，详见SECURITY.md。Windows/Linux不是用来评测恶意多用户代码的安全隔离服务。Electron界面沙盒不等于被编译C程序的沙盒。

AI真实调用依赖账号权限，不纳入公共CI。设备登录认证必须由用户本人完成。生成题通过有限测试集，不构成正确性或渐进复杂度证明。

默认构建没有Developer ID公证或Windows代码签名。未来签名证书只能配置在本机/受控Secrets中，不能提交仓库。不要把安装受阻的处理写成关闭系统安全保护。
