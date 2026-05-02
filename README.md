diff --git a/README.md b/README.md
index 1632d548026f3e1a48b32acd80293c7b192d2b41..7a754b6951863281a75e205aaff4d2bf483a6be5 100644
--- a/README.md
+++ b/README.md
@@ -1,40 +1,41 @@
 # Invite Chat Mock
 
 ## Pages
-- `create-room.html`: 部屋名を入力して新規部屋を作成するページ。
-- `index.html`: チャット画面。招待URLコピー、投稿、削除に対応。
+- `create-room.html`: 部屋作成ページ（見た目は `css/create-room.css`、処理は `js/create-room.js`）。
+- `index.html`: チャット画面（見た目は `css/chat.css`、処理は `js/chat.js`）。
+- `js/firebase-config.js`: Firebase設定を1箇所で管理。
 
 ## Firestore Rules
 - 本番用ルールは `firestore.rules` を使用。
 - 投稿削除は投稿者本人のみ許可（`authorId == request.auth.uid`）。
 - 部屋の削除は部屋作成者（`createdBy`）のみ許可。
 - 部屋/メッセージ読み取りはメンバーのみ許可。
 
 ## データベース構造（変更版 / Firebase想定）
 
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
 
 
 ## 追加仕様
 - `index.html` に「部屋を削除」ボタンを追加。作成者にのみ表示され、押すと部屋メタ情報とメッセージを削除して作成ページへ戻る。
 
 
 ## Firebase設定
-- `index.html` 内の `firebaseConfig` は空オブジェクト `{}` のままです。
-- 本番環境では Firebase Console のWebアプリ設定値を埋めてください。
+- `js/firebase-config.js` に Firebase Console のWebアプリ設定値を入力してください。
+- 各ページは `js/firebase-config.js` をimportして共通設定を利用します。
