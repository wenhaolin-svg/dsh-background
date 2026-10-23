# 把 dsh-background 发布到 GitHub

这份说明是给第一次发布 GitHub 仓库的人写的。按顺序做即可。发布完成后，DSH 的 **添加插件** 就能直接填仓库地址安装。

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
   - **Repository name**：`dsh-background`
   - **Description**：`用本地图片替换 DeepSeek Harness 的纯色背景`
   - 选择 **Public**
   - **不要**勾选 “Add a README file”“Add .gitignore”“Choose a license”（本项目已经自带）
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
   https://github.com/你的GitHub用户名/dsh-background
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

git remote add origin https://github.com/你的GitHub用户名/dsh-background.git
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
   https://github.com/你的GitHub用户名/dsh-background
   ```

5. 点击 **安装**。
6. 安装完成后启用 **dsh-background**，刷新页面。
7. 界面右侧中部出现圆形图片按钮，点开导入一张图片测试。

如果安装时报 “找不到组合包 patch” 或类似错误，优先检查：

- `package.json` 是否在仓库根目录；
- `package.json` 里的 `dsh.bundle.patch` 是否指向 `./cordis.patch.yml`；
- `cordis.patch.yml` 里的 `name` 是否和 `package.json` 的 `name` 完全一致（都是 `dsh-background`）；
- 仓库是否把 `cordis.patch.yml` 漏传了。

---

## 后续更新版本

1. 修改代码后，把 `package.json` 的 `version` 从 `1.0.0` 改成 `1.0.1`。
2. 提交并推送。
3. 在 DSH 插件页先卸载旧版，再按上面的地址重新安装（DSH 当前不会自动把 Git 安装的第三方插件升级到新提交）。
4. 刷新页面。

---

## 可选：打一个 Release

1. 在 GitHub 仓库页面点击右侧 **Releases → Create a new release**。
2. Tag 填 `v1.0.0`，标题填 `dsh-background v1.0.0`。
3. 描述里写主要功能。
4. 点击 **Publish release**。

Release 不是安装所必需的；DSH 直接读仓库根目录即可。它的作用是让别人看到版本和更新说明。

---

## 发布前自查清单

- [ ] 仓库根目录能看到 `package.json`
- [ ] `package.json` 的 `name` 是 `dsh-background`
- [ ] `package.json` 有 `dsh.bundle.patch` 和 `dsh.client`
- [ ] `cordis.patch.yml` 已上传，且 `name: dsh-background`
- [ ] `client.js` 和 `index.js` 已上传
- [ ] `locale/en.json`、`locale/zh.json`、`icon.svg` 已上传
- [ ] 没有上传 `_scratch`、`node_modules`、个人图片
- [ ] 仓库是 Public（或确认 DSH 有访问 Private 仓库的凭据）
- [ ] 在 DSH 里安装后，界面右侧中部按钮出现，导入图片能生效
