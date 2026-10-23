# 把 dsh-background-studio 发布到 GitHub

这份说明是给第一次发布 GitHub 仓库的人写的。按顺序做即可。发布完成后，DSH 的 **添加插件** 就能直接填仓库地址安装。

---

## 更新已经上传过的仓库

如果仓库里还是旧版 `dsh-background` 文件，用网页覆盖上传最省事。

### 用 GitHub 网页覆盖上传

1. 打开你的仓库主页。
2. 点击 **Add file → Upload files**。
3. 打开 `D:\dsh\插件` 文件夹，把下面这些内容重新拖进网页：
   - `package.json`
   - `index.js`
   - `client.js`
   - `cordis.patch.yml`
   - `README.md`
   - `PUBLISHING.zh.md`
   - `LICENSE`
   - `icon.svg`
   - `.gitignore`
   - `locale` 文件夹
   - `test` 文件夹

   同名文件会被覆盖，不需要先删除。
4. 底部提交信息填：

   ```text
   Release v1.1.1: rename to dsh-background-studio, draggable panel and launcher
   ```

5. 点击 **Commit changes**。
6. 打开仓库首页，确认：
   - `package.json` 里的 `"name"` 是 `dsh-background-studio`；
   - `"version"` 是 `1.1.1`；
   - `cordis.patch.yml` 里的 `name` 也是 `dsh-background-studio`。

> 不要把 `dsh-background-studio-1.1.1.tgz` 上传到代码文件里；它是 Release 附件，后面单独用。
>
> 如果你把 GitHub 仓库改名成了 `dsh-background-studio`，记得把 `package.json` 里的 `repository`、`homepage`、`bugs` 三个地址一起改成新仓库地址。GitHub 会自动重定向旧地址，但包元信息最好保持一致。

### 用 GitHub Desktop 更新

1. 打开 GitHub Desktop，选择你的仓库。
2. 把 `D:\dsh\插件` 里的新文件复制到本地仓库目录，覆盖旧文件。
3. 在左侧 Changes 里确认 `package.json`、`client.js`、`index.js`、`cordis.patch.yml` 都变了。
4. Summary 填 `Release v1.1.1`，点 **Commit to main**。
5. 点 **Push origin**。

---

## 发布前先确认

- 仓库根目录必须直接包含 `package.json`、`index.js`、`client.js`、`cordis.patch.yml`。
- 不要上传 `_scratch`、`node_modules`、临时日志或个人图片。
- 仓库建议设为 **Public**。如果设为 Private，DSH 安装时需要这台电脑已有可用的 GitHub 凭据。
- 下方命令里的 `你的GitHub用户名` 都要替换成真实用户名。

---

## 方法 A：网页上传（最简单，不用安装 Git）

1. 打开 <https://github.com>，登录或注册账号。
2. 点击右上角 **+** → **New repository**。
3. 填写：
   - **Repository name**：`dsh-background-studio`
   - **Description**：`用本地图片替换 DeepSeek Harness 的纯色背景`
   - 选择 **Public**
   - **不要**勾选 “Add a README file”“Add .gitignore”“Choose a license”（本项目已经自带）

> 包名固定为 `dsh-background-studio`。仓库名可以继续用旧的 `dsh-background`；安装 URL 填你实际仓库地址即可，DSH 以仓库里的 `package.json` 为准。

4. 点击 **Create repository**。
5. 在新仓库页面点击 **uploading an existing file**。
6. 打开本机的 `D:\dsh\插件` 文件夹，选中以下内容并拖进网页：
   - `index.js`
   - `client.js`
   - `package.json`
   - `cordis.patch.yml`
   - `icon.svg`
   - `README.md`
   - `PUBLISHING.zh.md`
   - `LICENSE`
   - `.gitignore`
   - `locale` 文件夹
   - `test` 文件夹
7. 在页面底部填写提交信息，例如 `Initial release`，点击 **Commit changes**。
8. 回到仓库首页，复制地址，应类似：

   ```text
   https://github.com/你的GitHub用户名/dsh-background-studio
   ```

9. 在 DSH 的插件页粘贴这个地址安装。安装前建议先在浏览器打开该地址，确认能看到 `package.json` 和 `README.md`。

> 网页上传也支持直接拖整个文件夹。上传后检查 `locale/`、`test/` 是否还在，以及 `package.json` 是否在仓库最外层。

---

## 方法 B：GitHub Desktop（适合之后持续更新）

1. 安装 [GitHub Desktop](https://desktop.github.com/) 并登录。
2. 菜单 **File → Add local repository**，选择 `D:\dsh\插件`。
3. 如果提示 “not a Git repository”，点击 **create a repository**，保持路径不变，点击 **Create repository**。
4. 在左侧 Changes 中检查文件列表，确认没有 `_scratch` 和 `node_modules`。
5. 在左下角 Summary 填写 `Initial release`，点击 **Commit to main**。
6. 点击顶部 **Publish repository**。
7. 取消勾选 **Keep this code private**，点击 **Publish repository**。
8. 发布完成后点击 **Repository → View on GitHub**，复制仓库地址。

之后每次修改：

1. 回到 GitHub Desktop；
2. 写一句 Summary；
3. **Commit to main**；
4. **Push origin**。

---

## 方法 C：命令行 Git（已经装好 Git 时）

在 PowerShell 中执行：

```powershell
cd D:\dsh\插件

git init
git add .
git commit -m "Initial release"
git branch -M main

git remote add origin https://github.com/你的GitHub用户名/dsh-background-studio.git
git push -u origin main
```

如果 GitHub 要求登录，按弹窗提示在浏览器中授权即可。不要在这里输入密码到聊天窗口。

---

## 发布之后：在 DSH 里安装

1. 打开 DSH 左侧栏的 **插件 / Plugins**。
2. 点击 **添加插件**。
3. 选择 **安装第三方插件**。
4. 粘贴：

   ```text
   https://github.com/你的GitHub用户名/dsh-background-studio
   ```

5. 点击 **安装**。
6. 安装完成后启用 **dsh-background-studio**，刷新页面。
7. 界面右侧中部出现圆形图片按钮，点开导入一张图片测试。

如果安装时报 “找不到组合包 patch” 或类似错误，优先检查：

- `package.json` 是否在仓库根目录；
- `package.json` 里的 `dsh.bundle.patch` 是否指向 `./cordis.patch.yml`；
- `cordis.patch.yml` 里的 `name` 是否和 `package.json` 的 `name` 完全一致（都是 `dsh-background-studio`）；
- 仓库是否把 `cordis.patch.yml` 漏传了。

---

## 上架到插件市场

你装的 `dshmarket` 的插件列表来自 **awesome-dsh-plugin**，不是把仓库提交给 `dshmarket` 本身。上架 = 去 awesome-dsh-plugin 提一个 PR，新增一个 YAML 文件。

### 1. 先满足收录条件

- GitHub 仓库是 **Public**；
- 仓库创建已满 **1 天**；
- 给仓库加上 **`dsh-plugin`** topic（仓库首页右侧 About → 齿轮 → Topics）；
- `package.json` 里有 `dsh.bundle`（本项目已有）；
- 描述只写真实功能，不写“最好用”之类的营销词。

### 2. Fork 并新增条目

1. 打开 <https://github.com/awesome-dsh-plugin/awesome-dsh-plugin>，点 **Fork**。
2. 在你的 fork 里进入 `data/plugins/`。
3. 新建一个文件。文件名按你的仓库名来：
   - 仓库仍是 `dsh-background`：`wenhaolin-svg__dsh-background.yml`
   - 已改名为 `dsh-background-studio`：`wenhaolin-svg__dsh-background-studio.yml`
4. 填入：

   ```yaml
   url: https://github.com/wenhaolin-svg/dsh-background
   name: wenhaolin-svg/dsh-background
   category: ui
   description:
     en: Replace the DSH solid background with a local image, with a draggable editor for fit, blur, veil and interface opacity.
     zh: 用本地图片替换 DSH 的纯色背景，并提供可拖动面板来调整铺满方式、模糊、遮罩和界面不透明度。
   ```

   > `url` 和 `name` 必须换成你**实际仓库**的地址。如果仓库改名了，两处都要改，文件名也要改。
   >
   > `category` 用 `ui`（UI 增强）即可；如果维护者认为更适合 `theme`，他们会调整，不会因此打回。

5. 提交这个文件，向 `awesome-dsh-plugin` 开 PR。标题可以写：

   ```text
   Add dsh-background-studio
   ```

6. 等 CI 和人工审核。只提交这一个 YAML 文件，不要手动改 README。

### 3. 让安装不再依赖 git（可选，但推荐）

如果 YAML 里只有 `url`，市场和 DSH 最终回退到 GitHub 源码安装时仍然需要 git。要让用户走 HTTPS 预构建包：

1. 在本地生成压缩包：

   ```powershell
   cd D:\dsh\插件
   pnpm pack
   ```

   会得到：

   ```text
   dsh-background-studio-1.1.1.tgz
   ```

   > 本机没有 `pnpm` 命令也没关系：`D:\dsh\插件\dsh-background-studio-1.1.1.tgz` 已经生成好了，直接上传这个文件即可。

2. 在 GitHub 仓库创建 Release `v1.1.1`，把这个 `.tgz` 作为附件上传。
3. 在上面的 YAML 里加一行 `tarball`：

   ```yaml
   tarball: https://github.com/wenhaolin-svg/dsh-background/releases/download/v1.1.1/dsh-background-studio-1.1.1.tgz
   ```

   注意：这里用的是**钉住版本号**的 Release 地址，文件名里的版本号要和实际附件一致，否则会 404。

4. 这样市场会优先安装这个 tarball，不需要 git。

> 也可以把包发布到 npm（包名 `dsh-background-studio`），并确保 `package.json` 的 `repository` 指回 GitHub 仓库。市场会自动从 npm 映射，不需要在 YAML 里手写 `npm:` 字段；手写反而会被校验拒绝。

### 4. 合并之后

- 列表和网站会自动重建，通常一天内生效；
- 在 DSH 里打开插件市场搜索 `dsh-background-studio` 或作者名即可看到；
- 以后更新版本时，同样只改自己的 YAML 条目（如需要）并在自己的仓库更新代码/Release。

---

## 后续更新版本

1. 修改代码后，把 `package.json` 的 `version` 从 `1.1.1` 改成 `1.1.2`。
2. 提交并推送。
3. 在 DSH 插件页先卸载旧版，再按上面的地址重新安装（DSH 当前不会自动把 Git 安装的第三方插件升级到新提交）。
4. 刷新页面。

---

## 可选：打一个 Release

1. 在 GitHub 仓库页面点击右侧 **Releases → Create a new release**。
2. Tag 填 `v1.1.1`，标题填 `dsh-background-studio v1.1.1`。
3. 描述里写主要功能。
4. 点击 **Publish release**。

Release 不是安装所必需的；DSH 直接读仓库根目录即可。它的作用是让别人看到版本和更新说明。

---

## 发布前自查清单

- [ ] 仓库根目录能看到 `package.json`
- [ ] `package.json` 的 `name` 是 `dsh-background-studio`
- [ ] `package.json` 有 `dsh.bundle.patch` 和 `dsh.client`
- [ ] `cordis.patch.yml` 已上传，且 `name: dsh-background-studio`
- [ ] `client.js` 和 `index.js` 已上传
- [ ] `locale/en.json`、`locale/zh.json`、`icon.svg` 已上传
- [ ] 没有上传 `_scratch`、`node_modules`、个人图片
- [ ] 仓库是 Public（或确认 DSH 有访问 Private 仓库的凭据）
- [ ] 在 DSH 里安装后，界面右侧中部按钮出现，导入图片能生效
