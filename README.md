# 海報生成器 (Made By ChatGPT, Audited and Edited Modified By october1234)

完整的 React + TypeScript + Tailwind CSS 靜態專案，使用 Vite 建置。保留目前海報生成器的繁體中文介面、六個文字欄位、文字自動縮放、照片裁切／縮放，以及固定 1920 × 1080 JPG 匯出。

此版本可獨立部署至 GitHub Pages，不需要伺服器、資料庫、OpenAI 帳號或 API 金鑰。照片選取、裁切與匯出均在使用者瀏覽器內執行。

## 首次部署

1. 在 GitHub 建立 repository，預設分支使用 `main`。
2. 將本資料夾內的**全部內容**放在 repository 根目錄。`package.json`、`index.html` 和 `.github/` 必須直接位於根目錄，請勿只上傳 ZIP 或漏掉 `.github` 隱藏資料夾。
3. 在 repository 的 **Settings → Pages → Build and deployment → Source** 選取 **GitHub Actions**。
4. 將程式推送至 `main`。到 **Actions → Deploy to GitHub Pages** 查看結果。
5. 如果第一次推送早於第 3 步，完成設定後，在 Actions 選取 **Run workflow**，或推送下一個 commit。

之後每次推送到 `main` 都會自動執行：`npm ci` → TypeScript 檢查 → Vite 建置 → 部署。其他分支的推送不會部署；若使用不同部署分支，請修改 `.github/workflows/deploy.yml` 的 `branches`，並確認 `github-pages` environment 允許該分支。

GitHub Free 使用 public repository 即可啟用 Pages；private repository 的可用性取決於 GitHub 方案。部署時會一併發佈 `public/assets/` 中提供的範例照片、鴿子圖案及 QR code，可先換成要公開展示的素材。

### 使用 Git 推送

先建立空白的 GitHub repository，然後在解壓縮後的專案資料夾執行；將下列 `YOUR_USERNAME` 與 `YOUR_REPO` 替換成你的資料：

```bash
git init -b main
git add .
git commit -m "Add poster generator and Pages deployment"
git remote add origin https://github.com/YOUR_USERNAME/YOUR_REPO.git
git push -u origin main
```

repository 的登入與推送使用你自己的 GitHub 認證。workflow 使用 GitHub 自動提供的 `GITHUB_TOKEN`；不需要自行新增 PAT 或 repository secret。

## 本機開發

安裝 Node.js 24；如使用 nvm，可在專案資料夾執行 `nvm use`。

```bash
npm ci
npm run dev
```

開啟終端機顯示的本機網址。

```bash
npm run build
npm run preview
```

`npm run build` 先檢查 TypeScript，再輸出 `dist/`。不可直接雙擊原始 `index.html` 執行，請使用開發伺服器或建置後的靜態伺服器。

## 檔案位置

| 檔案 | 用途 |
| --- | --- |
| `.github/workflows/deploy.yml` | 推送至 `main` 時自動部署，也支援手動執行 |
| `src/App.tsx` | 編輯器、文字自動縮放、照片選取、裁切與 JPG 匯出 |
| `src/index.css` | 繁體中文介面、響應式版面及海報樣式 |
| `src/lib/poster-layout.ts` | 固定畫布尺寸、照片裁切座標與邊界計算 |
| `src/components/ui/` | 按鈕、輸入欄位、滑桿、對話框元件 |
| `public/assets/` | 鴿子、QR code 與原始範例海報圖片 |
| `index.html` | 網頁名稱、語言與 favicon |
| `vite.config.ts` | React 建置設定及相對資源路徑 |
| `package-lock.json` | 可重現的 npm 依賴版本 |

## GitHub Pages 路徑

`vite.config.ts` 使用 `base: "./"`，圖片與 favicon 也使用相同基底路徑。因此可放在根網址或一般 repository 子目錄，不必把 repository 名稱寫死在程式碼中。此程式只有一個頁面，無額外路由或伺服器端重導需求。

## 素材與海報內容

- 可編輯：聚會名稱、主題、主領、日期、時間、地點。
- 文字會自動縮放至指定區域內；主題可自行換行。
- 照片支援 JPG、PNG、WebP（上限 20 MB），可拖曳、縮放或用位置滑桿調整。按「套用裁切」後才套用到海報。
- `sample.jpg` 是原始範例海報。預設只顯示其中右側照片區域，座標位於 `SAMPLE_PHOTO.region`；換成獨立照片時，請同步更新其尺寸及範圍，或使用介面選取照片。
- 範例照片與 QR code 的素材權利維持原權利人所有。
- JPG 固定為 1920 × 1080，與裝置螢幕大小無關；中文字型會依裝置上可用的系統字型呈現。

## 常見部署問題

- **找不到 Pages site / Configure GitHub Pages 失敗**：先在 Settings → Pages 選取 GitHub Actions，確認該 repository 的方案支援 Pages，再重新執行 workflow。
- **Actions 沒有執行**：確認 `.github/workflows/deploy.yml` 位於根目錄、推送分支為 `main`，且 repository／組織未停用 Actions。
- **部署等待核准**：若 `github-pages` environment 設有保護規則，需要有權限的人依規則核准。
- **npm ci 失敗**：修改 `package.json` 後，先在本機執行 `npm install` 並將更新的 `package-lock.json` 一起提交。
- **圖片出現 404**：確認 `public/assets/` 已提交，並保留 `import.meta.env.BASE_URL` 與 `%BASE_URL%` 的相對路徑處理。

## 官方說明

- [GitHub Pages 自訂 workflow](https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages)
- [設定 GitHub Pages 發佈來源](https://docs.github.com/en/pages/getting-started-with-github-pages/configuring-a-publishing-source-for-your-github-pages-site)
- [Vite 靜態部署](https://vite.dev/guide/static-deploy.html)

## 已完成的驗證

- `npm ci` 成功，依 lockfile 安裝完整依賴。
- `npm run build` 成功，包含 TypeScript 型別檢查。
- 已檢查 YAML 語法、`main` 推送觸發條件、部署權限、artifact 路徑，以及根網址／repository 子目錄的靜態資源路徑。
- 尚未在你的 GitHub repository 執行 Actions；首次部署需完成上方 Pages 設定。

## 第三方授權

`src/components/ui/` 與 `src/vendor/shadcn-tailwind-4.13.0.css` 依 shadcn 的 MIT 授權提供，授權文字保留於 `src/vendor/shadcn-tailwind-4.13.0.LICENSE.md`。其他 npm 套件依各自授權提供。
