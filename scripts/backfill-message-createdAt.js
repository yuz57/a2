#!/usr/bin/env node

/**
 * Backfill missing or invalid createdAt fields for rooms/{roomId}/messages/{messageId}.
 *
 * Usage:
 *   node scripts/backfill-message-createdAt.js [--dry-run]
 */

const admin = require('firebase-admin');

const DRY_RUN = process.argv.includes('--dry-run');
// --dry-run 指定時は更新を行わず、対象判定とログ出力のみ実施する。

if (!admin.apps.length) {
  // Firebase Admin SDK の多重初期化を防ぐため、未初期化時のみ initialize する。
  admin.initializeApp();
}

const db = admin.firestore();
const { FieldValue, Timestamp } = admin.firestore;

function isValidTimestamp(value) {
  return value instanceof Timestamp;
}

function candidateFromDeletedAt(data) {
  // deletedAt が Timestamp として有効な場合のみ補完候補に採用する。
  if (!isValidTimestamp(data.deletedAt)) {
    return null;
  }

  // 並び順維持のため、可能なら deletedAt より 1ms 前の時刻を createdAt 候補として使う。
  const deletedMs = data.deletedAt.toMillis();
  return Timestamp.fromMillis(Math.max(0, deletedMs - 1));
}

function candidateFromMetadata(snapshot) {
  // メタデータ由来の近似作成時刻として、createTime -> updateTime -> readTime の順で代替値を探す。
  const createTime = snapshot.createTime;
  if (isValidTimestamp(createTime)) {
    return createTime;
  }

  const updateTime = snapshot.updateTime;
  if (isValidTimestamp(updateTime)) {
    return updateTime;
  }

  const readTime = snapshot.readTime;
  if (isValidTimestamp(readTime)) {
    return readTime;
  }

  return null;
}

async function run() {
  console.log(`[start] createdAt backfill (dryRun=${DRY_RUN})`);

  const roomDocs = await db.collection('rooms').select().get();
  console.log(`[scan] rooms=${roomDocs.size}`);

  let scanned = 0;
  let targets = 0;
  let updated = 0;

  // 全 room を走査し、各 message の createdAt を検証して補完対象を処理するバッチ。
  for (const roomDoc of roomDocs.docs) {
    const roomId = roomDoc.id;
    const messagesRef = db.collection('rooms').doc(roomId).collection('messages');
    const messageDocs = await messagesRef.get();

    for (const messageDoc of messageDocs.docs) {
      scanned += 1;
      const messageId = messageDoc.id;
      const data = messageDoc.data() || {};

      // 既に正常な createdAt を持つメッセージは補完不要なのでスキップする。
      if (isValidTimestamp(data.createdAt)) {
        continue;
      }

      targets += 1;

      const fromDeletedAt = candidateFromDeletedAt(data);
      const fromMeta = candidateFromMetadata(messageDoc);

      // 補完値は deletedAt を最優先し、なければメタデータ、最後に serverTimestamp を使う。
      let patchValue;
      let source;
      if (fromDeletedAt) {
        patchValue = fromDeletedAt;
        source = 'deletedAt';
      } else if (fromMeta) {
        patchValue = fromMeta;
        source = 'metadata';
      } else {
        patchValue = FieldValue.serverTimestamp();
        source = 'serverTimestamp';
      }

      console.log(`[target] roomId=${roomId} messageId=${messageId} source=${source}`);

      // dry-run 時は書き込みを行わず、実行時のみ createdAt を更新する。
      if (!DRY_RUN) {
        await messageDoc.ref.update({ createdAt: patchValue });
        updated += 1;
      }
    }
  }

  console.log(`[done] scanned=${scanned} targets=${targets} updated=${DRY_RUN ? 0 : updated}`);
}

run().catch((err) => {
  console.error('[error] backfill failed', err);
  process.exitCode = 1;
});
