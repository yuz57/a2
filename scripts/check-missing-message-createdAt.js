#!/usr/bin/env node

/**
 * Count messages missing a valid createdAt under rooms/*/messages/*.
 */

const admin = require('firebase-admin');

if (!admin.apps.length) {
  // 既存の Firebase app が未初期化のときだけ initialize する。
  admin.initializeApp();
}

const db = admin.firestore();
const { Timestamp } = admin.firestore;

function isValidTimestamp(value) {
  return value instanceof Timestamp;
}

async function run() {
  // このスクリプトは更新を行わず、createdAt 欠損件数の可視化のみを行う。
  const rooms = await db.collection('rooms').select().get();
  let missing = 0;
  let scanned = 0;

  // 全 room を順次処理する。
  for (const room of rooms.docs) {
    const messages = await db.collection('rooms').doc(room.id).collection('messages').get();
    // 各 room 配下の全 message を走査する。
    for (const msg of messages.docs) {
      scanned += 1;
      const createdAt = msg.get('createdAt');
      // createdAt が Timestamp でない場合を欠損（または不正）として扱う。
      if (!isValidTimestamp(createdAt)) {
        missing += 1;
        console.log(`[missing] roomId=${room.id} messageId=${msg.id}`);
      }
    }
  }

  // scanned と missing の集計結果を出力する。
  console.log(`[done] scanned=${scanned} missing=${missing}`);
}

run().catch((err) => {
  console.error('[error] check failed', err);
  process.exitCode = 1;
});
