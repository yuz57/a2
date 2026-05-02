#!/usr/bin/env node

/**
 * Backfill missing or invalid createdAt fields for rooms/{roomId}/messages/{messageId}.
 *
 * Usage:
 *   node scripts/backfill-message-createdAt.js [--dry-run]
 */

const admin = require('firebase-admin');

const DRY_RUN = process.argv.includes('--dry-run');

if (!admin.apps.length) {
  admin.initializeApp();
}

const db = admin.firestore();
const { FieldValue, Timestamp } = admin.firestore;

function isValidTimestamp(value) {
  return value instanceof Timestamp;
}

function candidateFromDeletedAt(data) {
  if (!isValidTimestamp(data.deletedAt)) {
    return null;
  }

  // Keep ordering sane by nudging one millisecond before deletedAt when possible.
  const deletedMs = data.deletedAt.toMillis();
  return Timestamp.fromMillis(Math.max(0, deletedMs - 1));
}

function candidateFromMetadata(snapshot) {
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

  for (const roomDoc of roomDocs.docs) {
    const roomId = roomDoc.id;
    const messagesRef = db.collection('rooms').doc(roomId).collection('messages');
    const messageDocs = await messagesRef.get();

    for (const messageDoc of messageDocs.docs) {
      scanned += 1;
      const messageId = messageDoc.id;
      const data = messageDoc.data() || {};

      if (isValidTimestamp(data.createdAt)) {
        continue;
      }

      targets += 1;

      const fromDeletedAt = candidateFromDeletedAt(data);
      const fromMeta = candidateFromMetadata(messageDoc);

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
