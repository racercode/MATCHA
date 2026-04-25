# data/

存放要上傳到 Matcha 後端（Firestore `gov_resources`）的政府資源資料。

## 資料夾結構

每個資源一個資料夾，裡面包含：

```
data/
├── upload.js              ← 上傳腳本
├── README.md
├── 青年創業共享空間租賃補助作業要點/
│   ├── metadata.json      ← 必要，資源基本資料
│   ├── 作業要點.pdf        ← 文件檔案（PDF / md / txt / html / csv / xlsx）
│   └── QA.pdf
├── 青創貸款及補助/
│   ├── metadata.json
│   └── ...
└── ...
```

### metadata.json 格式

```json
{
  "rid": "rid-coworking-space-subsidy-115",
  "agencyId": "taipei-youth-dept",
  "agencyName": "臺北市政府青年局",
  "name": "青年創業共享空間租賃補助",
  "description": "鼓勵創業初期之營利事業...",
  "eligibilityCriteria": [
    "營利事業：依公司法登記於本市未滿三年",
    "代表人須為 18–45 歲中華民國國民"
  ],
  "contactUrl": "https://youth.gov.taipei/..."
}
```

| 欄位 | 必填 | 說明 |
|------|------|------|
| `rid` | 是 | 資源唯一 ID，建議格式 `rid-xxx` |
| `agencyId` | 是 | 機關 ID |
| `agencyName` | 是 | 機關名稱 |
| `name` | 是 | 資源名稱 |
| `description` | 是 | 資源描述 |
| `eligibilityCriteria` | 否 | 申請資格條件（字串陣列） |
| `contactUrl` | 否 | 聯絡/申請網址 |

### 支援的文件格式

`metadata.json` 以外的檔案會被當成文件上傳：

- `.pdf` — 後端會解析文字
- `.md` / `.txt` / `.csv` — 以 UTF-8 文字保存
- `.html` — 移除 tag 後保存正文
- `.xlsx` / `.xls` — 逐 sheet 轉 CSV

## 使用方式

需要先設定好 `services/api/.env` 的 Firebase credentials（不需要啟動 API server）。

```bash
# 上傳所有有 metadata.json 的資料夾
node data/upload.js --all

# 上傳指定資料夾
node data/upload.js 青年創業共享空間租賃補助作業要點

# 預覽（不實際上傳）
node data/upload.js --dry-run --all
```

### 前置需求

- `services/api/.env` 需要設定 `FIREBASE_PROJECT_ID`、`FIREBASE_CLIENT_EMAIL`、`FIREBASE_PRIVATE_KEY`
- 已安裝 dependencies（`pnpm install`）

### 上傳流程

腳本直接透過 Firebase Admin SDK 寫入 Firestore，不經過 REST API：

1. 讀取資料夾的 `metadata.json`
2. `upsertGovernmentResource()` — 寫入 `gov_resources/{rid}`
3. 對每個文件檔，解析文字後 `createGovernmentResourceDocument()` — 寫入 `gov_resources/{rid}/documents/{docId}`

## 新增資源

1. 在 `data/` 下建立新資料夾（中文名即可）
2. 建立 `metadata.json`，填入資源基本資料（參考上方格式）
3. 把相關文件（PDF、說明文件等）放進資料夾
4. 執行 `node data/upload.js <資料夾名稱>` 上傳
