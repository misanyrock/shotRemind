# 截个提醒 · ShotRemind

用一张截图创建提醒。适合记下群通知里的材料截止时间、预约短信里的复诊时间，以及缴费、取件等日常待办。支持 iOS 和 Android，使用 React Native、Expo 和 TypeScript 开发。

## 界面预览

| 首页 | 确认提醒 |
| :---: | :---: |
| <img src="docs/screenshots/ios-home.png" width="320" alt="截个提醒首页，包含选择截图、手动添加和待办列表"> | <img src="docs/screenshots/ios-confirm.png" width="320" alt="确认提醒界面，显示示例事项、日期时间和识别文字"> |

截图来自 iOS 27.1 模拟器。确认页使用 App 内置的群通知示例。

## 使用流程

1. 点「选择截图」，从相册导入一张含事项和时间的图片。也可以点「体验示例」走一遍流程。
2. 检查识别出的事项和时间，可切换候选或手动编辑。只有日期时预填 09:00；「明天」「下周二」等相对日期以导入当天为准。
3. 保存并允许系统通知。Android 12 及以上如果提示缺少「闹钟和提醒」权限，请在系统设置中开启后返回保存。
4. 点按通知或提醒列表中的事项，再点「原始截图」回看来源。处理完可标为完成，也可以删除提醒和应用内的截图副本。

「手动添加」可以创建一条没有截图的提醒。截图识别在设备上完成，提醒和原图副本保存在应用本地。

## 发图前遮隐私

在首页点「发图前遮隐私」，从相册选一张快递单、订单截图或聊天记录。应用在设备上标出疑似手机号、地址和姓名。点按标框应用或取消遮挡。漏识别的区域可以点「手动框选」，再点图片上矩形的两个对角。检查整张图后，点「分享遮挡后的图片」，通过系统分享一张写入实色遮挡的 PNG 副本。

## 本地运行

- **通用** · Node.js 22.13+ 或 24.3+、npm。
- **iOS** · macOS、Xcode、CocoaPods，以及 iOS 模拟器或设备。
- **Android** · JDK 17、Android SDK 36、NDK `27.1.12297006`，以及 Android 模拟器或设备。

```sh
git clone https://github.com/misanyrock/shotRemind.git
cd shotRemind
npm ci
npm run prebuild

# 选择一个平台
npm run ios
npm run android
```

原生 OCR 模块需要 Expo 开发构建。完成首次安装后，可用 `npm start` 启动 Metro。根目录的 `ios/` 和 `android/` 由 Expo Prebuild 生成，自定义原生 OCR 源码保存在 `modules/shot-ocr/`。

```sh
npm run typecheck
```

## 项目结构

| 路径 | 用途 |
| --- | --- |
| `App.tsx` | 导入截图、确认提醒、待办列表和详情界面 |
| `src/recognize.ts` | 从 OCR 文字中提取事项和中文日期时间 |
| `src/reminders.ts` | 本地存储、截图副本管理和系统通知 |
| `modules/shot-ocr/` | iOS Vision 和 Android ML Kit OCR 桥接 |
| `plugins/` | Expo 原生工程生成配置 |

## 许可证

本项目采用 MIT 许可证，见 [LICENSE](LICENSE)。第三方依赖适用各自的许可证。
