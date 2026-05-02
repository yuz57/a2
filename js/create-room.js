import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js';
import { getAuth, signInAnonymously } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js';
import { getFirestore, doc, setDoc, serverTimestamp } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';
import { firebaseConfig } from './firebase-config.js';

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

const createBtn = document.getElementById('createBtn');
const roomNameInput = document.getElementById('roomName');

createBtn.addEventListener('click', async () => {
  const roomName = roomNameInput.value.trim() || '新しい部屋';
  const roomId = crypto.randomUUID().replace(/-/g, '');

  createBtn.disabled = true;
  createBtn.textContent = '作成中...';

  try {
    await signInAnonymously(auth);
    const creatorId = auth.currentUser?.uid;
    if (!creatorId) throw new Error('匿名認証に失敗しました');

    await setDoc(doc(db, 'rooms', roomId), {
      name: roomName,
      createdBy: creatorId,
      createdAt: serverTimestamp()
    });

    const chatUrl = new URL('./index.html', location.href);
    chatUrl.searchParams.set('roomId', roomId);
    chatUrl.searchParams.set('room', roomId);
    chatUrl.searchParams.set('roomid', roomId);
    chatUrl.searchParams.set('name', roomName);
    location.href = chatUrl.toString();
  } catch (error) {
    console.error(error);
    alert('部屋の作成に失敗しました。Firebase設定と接続を確認してください。');
    createBtn.disabled = false;
    createBtn.textContent = '部屋を作成して入室';
  }
});
