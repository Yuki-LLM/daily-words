# Daily Words 手机安装指南

## 最快体验：手机浏览器添加到主屏幕

1. 电脑和手机连接同一个 Wi-Fi。
2. 在电脑上运行本地预览服务。
3. 手机浏览器打开电脑的局域网地址，例如 `http://10.35.173.250:4173`。
4. 在手机浏览器菜单里选择添加到主屏幕。

这种方式最简单，体验接近 App，但本质还是通过本地网页访问。

## 安卓：生成 APK 后安装

需要先安装：

- Node.js
- Android Studio
- Android SDK

步骤：

1. 在项目文件夹打开终端。
2. 安装依赖：
   `npm install`
3. 生成网页打包资源：
   `npm run build`
4. 创建 Android 项目：
   `npx cap add android`
5. 同步 App 文件：
   `npx cap sync android`
6. 打开 Android Studio：
   `npx cap open android`
7. 在 Android Studio 里选择 Build APK。
8. 把生成的 `.apk` 文件传到安卓手机，点击安装。

如果手机提示风险，需要允许“安装未知来源应用”。

## iPhone：两种方式

### 简单方式

用 Safari 打开网页版本，然后添加到主屏幕。

### 真正安装包方式

iPhone 的 `.ipa` 安装包必须用 Mac + Xcode + Apple Developer 签名。

步骤大致是：

1. 在 Mac 上安装 Xcode。
2. 在项目里运行：
   `npm install`
3. 创建 iOS 项目：
   `npx cap add ios`
4. 同步文件：
   `npx cap sync ios`
5. 打开 Xcode：
   `npx cap open ios`
6. 用 Apple ID 签名，然后装到 iPhone 或上传 TestFlight。

Windows 电脑不能直接生成可安装到 iPhone 的正式 App，这是苹果系统限制。
