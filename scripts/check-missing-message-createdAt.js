#!/usr/bin/env node

/**
 * Count messages missing a valid createdAt under rooms/*/messages/*.
 */

const admin = require('firebase-admin');

if (!admin.apps.length) {
  admin.initializeApp();
}

const db = admin.firestore();
const { Timestamp } = admin.firestore;

function isValidTimestamp(value) {
  return value instanceof Timestamp;
}

async function run() {
  const rooms = await db.collection('rooms').select().get();
  let missing = 0;
  let scanned = 0;

  for (const room of rooms.docs) {
    const messages = await db.collection('rooms').doc(room.id).collection('messages').get();
    for (const msg of messages.docs) {
      scanned += 1;
      const createdAt = msg.get('createdAt');
      if (!isValidTimestamp(createdAt)) {
        missing += 1;
        console.log(`[missing] roomId=${room.id} messageId=${msg.id}`);
      }
    }
  }

  console.log(`[done] scanned=${scanned} missing=${missing}`);
}

run().catch((err) => {
  console.error('[error] check failed', err);
  process.exitCode = 1;
});
