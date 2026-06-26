# 用 GitHub 自动生成 APK

这是最简单的非网页安装方式：把项目上传到 GitHub，让 GitHub 云端自动打包安卓 APK，然后你用手机下载。

## 第一次设置

1. 在 GitHub 新建一个仓库，比如 `daily-words`。
2. 把这个项目文件夹里的内容上传到仓库。
3. 打开仓库的 `Actions` 页面。
4. 如果 GitHub 提示启用 Actions，点启用。

## 生成 APK

1. 进入 `Actions`。
2. 点左侧 `Build Android APK`。
3. 点右侧 `Run workflow`。
4. 等它跑完，通常需要几分钟。
5. 打开仓库的 `Releases` 页面。
6. 找到最新的 `Daily Words APK ...`。
7. 下载 `Daily-Words.apk`。

## 在安卓手机安装

1. 手机打开 GitHub 仓库的 `Releases` 页面。
2. 下载 `Daily-Words.apk`。
3. 点开 APK 安装。
4. 如果手机提示不允许安装未知来源应用，按提示允许浏览器或 GitHub 安装即可。

## iPhone 说明

这个方法只能生成安卓 APK。iPhone 不能直接安装 APK，也不能像安卓一样随便下载 `.ipa` 安装。iPhone 真正安装 App 仍然需要 Mac、Xcode 和 Apple 签名。
