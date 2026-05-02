import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js';
import { getAuth, signInAnonymously } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js';
import { getFirestore, doc, setDoc, collection, addDoc, query, orderBy, onSnapshot, deleteDoc, serverTimestamp } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';
import { firebaseConfig } from './firebase-config.js';

// このファイルはチャット画面のフロント処理を担当する。
// ルーム情報をもとに初期化し、メッセージの送信/受信をFirestoreと同期する。
// 受信データをDOMへ描画し、画面状態（入力欄・スクロール）を更新する。

// Firebase設定から接続先を初期化し、認証/DBクライアントを準備する。
// あわせてURLパラメータ由来のルームコンテキスト（roomId/roomName）を扱える状態にする。
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

const form = document.getElementById('composer');
const input = document.getElementById('text');
const username = document.getElementById('username');
const messages = document.getElementById('messages');
const copyInviteBtn = document.getElementById('copyInviteBtn');
const roomSub = document.getElementById('roomSub');
const roomTitle = document.getElementById('roomTitle');

const params = new URLSearchParams(location.search);
const roomId = params.get('roomId') || params.get('room') || params.get('roomid') || crypto.randomUUID().replace(/-/g, '');
const roomName = params.get('name') || '招待制チャットルーム';
roomTitle.textContent = roomName;
roomSub.textContent = `Room: ${roomId}`;

await signInAnonymously(auth);
const uid = auth.currentUser.uid;
await setDoc(doc(db, 'rooms', roomId, 'members', uid), {
  displayName: username.value.trim() || 'you',
  joinedAt: serverTimestamp()
}, { merge: true });

function autoResize(el){ el.style.height='auto'; el.style.height=Math.min(el.scrollHeight,160)+'px'; }
function fmt(ts){ const d = ts?.toDate?.() || new Date(); return `${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`; }

input.addEventListener('input',()=>autoResize(input));
username.addEventListener('change', async ()=>{
  await setDoc(doc(db, 'rooms', roomId, 'members', uid), { displayName: username.value.trim() || 'you', joinedAt: serverTimestamp() }, { merge: true });
});

// 送信時は「入力値取得 → 空文字チェック → Firestore保存 → 入力UI更新」の順で処理する。
// 保存失敗時は後段のcatchで通知し、ユーザーが再試行できる状態を保つ。
form.addEventListener('submit', async (e)=>{
  e.preventDefault();
  const text=input.value.trim(); if(!text) return;
  try {
    await addDoc(collection(db,'rooms',roomId,'messages'),{ text, authorId: uid, authorName: username.value.trim()||'you', createdAt: serverTimestamp(), deletedAt: null });
    input.value=''; autoResize(input);
  } catch (err) {
    console.error(err);
    alert('送信に失敗しました。権限設定・接続を確認してください。');
  }
});
input.addEventListener('keydown',(e)=>{ if(e.key==='Enter'&&!e.shiftKey){ e.preventDefault(); form.requestSubmit(); } });

const q = query(collection(db,'rooms',roomId,'messages'), orderBy('createdAt','asc'));
// メッセージ一覧をリアルタイム監視し、更新が届くたびに画面を再描画して最新状態を反映する。
// 初回表示と追加/削除の変化を同じ経路で処理し、UI整合性を維持する。
onSnapshot(q, (snap)=>{
  messages.innerHTML='';
  snap.forEach((d)=>{
    const m=d.data(); if(m.deletedAt) return;
    // 自分の投稿は `mine`、他者は `other` に振り分けて見た目を分岐する。
    // 末尾へ自動スクロールして、新着メッセージを見逃しにくくする。
    const div=document.createElement('div'); div.className=`msg ${m.authorId===uid?'mine':'other'}`;
    const meta=document.createElement('div'); meta.className='meta';
    const l=document.createElement('span'); l.textContent=`${m.authorName} ${fmt(m.createdAt)}`; meta.appendChild(l);
    if(m.authorId===uid){ const b=document.createElement('button'); b.className='delete-btn'; b.textContent='削除'; b.onclick=()=>deleteDoc(doc(db,'rooms',roomId,'messages',d.id)); meta.appendChild(b); }
    const body=document.createElement('div'); body.className='body'; body.textContent=m.text;
    div.append(meta,body); messages.appendChild(div);
  });
  messages.scrollTop=messages.scrollHeight;
}, (err) => {
  // 失敗時は開発者向けにログ出力しつつ、ユーザー向けには画面文言とアラートで通知する方針。
  // 原因切り分け（権限/接続）に必要な情報を残し、操作不能に見えないようにする。
  console.error(err);
  messages.innerHTML = '<div class="msg other">メッセージの読み込みに失敗しました（権限エラーの可能性があります）。</div>';
  alert('ルーム参加に失敗しました。招待URLが正しいか、Firestoreルールを確認してください。');
});

copyInviteBtn.addEventListener('click', async ()=>{
  const inviteUrl = new URL(location.href);
  inviteUrl.pathname = inviteUrl.pathname.replace(/\/$/, '');
  inviteUrl.search = '';
  inviteUrl.searchParams.set('roomId', roomId);
  inviteUrl.searchParams.set('room', roomId);
  inviteUrl.searchParams.set('roomid', roomId);
  inviteUrl.searchParams.set('name', roomName);

  const url = inviteUrl.toString();
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(url);
  } else {
    const ta = document.createElement('textarea');
    ta.value = url;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.focus();
    ta.select();
    document.execCommand('copy');
    ta.remove();
  }
  copyInviteBtn.textContent='コピー完了!'; setTimeout(()=>copyInviteBtn.textContent='招待URLをコピー',1200);
});
