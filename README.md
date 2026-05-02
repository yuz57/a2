# Invite Chat Mock

## Pages
- `create-room.html`: 部屋作成ページ（見た目は `css/create-room.css`、処理は `js/create-room.js`）。
- `index.html`: チャット画面（見た目は `css/chat.css`、処理は `js/chat.js`）。
- `js/firebase-config.js`: Firebase設定を1箇所で管理。

## Firestore Rules
- 本番用ルールは `firestore.rules` を使用。
- 投稿削除は投稿者本人のみ許可（`authorId == request.auth.uid`）。
- 部屋の削除は部屋作成者（`createdBy`）のみ許可。
- 部屋/メッセージ読み取りはメンバーのみ許可。

## データベース構造
```text
rooms/{roomId}
  name: string
  createdBy: string (uid)
  createdAt: timestamp

rooms/{roomId}/members/{uid}
  displayName: string
  joinedAt: timestamp

rooms/{roomId}/messages/{messageId}
  text: string
  authorId: string (uid)
  authorName: string
  createdAt: timestamp
  deletedAt: timestamp | null
```

## `createdAt` 補完運用
### 1) 事前バックアップ（export）
```bash
gcloud firestore export gs://<bucket>/firestore-backup-$(date +%Y%m%d-%H%M%S)
```

### 2) ステージングでドライラン
```bash
node scripts/backfill-message-createdAt.js --dry-run
```

### 3) ステージングで実行
```bash
node scripts/backfill-message-createdAt.js
```

### 4) 履歴表示確認
- `orderBy('createdAt', 'asc')` を使う `js/chat.js` で時系列が崩れていないことを確認。

### 5) 本番実行後の定期監視
```bash
node scripts/check-missing-message-createdAt.js
```

## Firebase設定
- `js/firebase-config.js` に Firebase Console のWebアプリ設定値を入力してください。
- 各ページは `js/firebase-config.js` を import して共通設定を利用します。
