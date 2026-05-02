import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js';
import { getAuth, signInAnonymously } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js';
import { getFirestore, doc, setDoc, collection, addDoc, query, orderBy, onSnapshot, deleteDoc, serverTimestamp } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';
import { firebaseConfig } from './firebase-config.js';

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
onSnapshot(q, (snap)=>{
  messages.innerHTML='';
  snap.forEach((d)=>{
    const m=d.data(); if(m.deletedAt) return;
    const div=document.createElement('div'); div.className=`msg ${m.authorId===uid?'mine':'other'}`;
    const meta=document.createElement('div'); meta.className='meta';
    const l=document.createElement('span'); l.textContent=`${m.authorName} ${fmt(m.createdAt)}`; meta.appendChild(l);
    if(m.authorId===uid){ const b=document.createElement('button'); b.className='delete-btn'; b.textContent='削除'; b.onclick=()=>deleteDoc(doc(db,'rooms',roomId,'messages',d.id)); meta.appendChild(b); }
    const body=document.createElement('div'); body.className='body'; body.textContent=m.text;
    div.append(meta,body); messages.appendChild(div);
  });
  messages.scrollTop=messages.scrollHeight;
}, (err) => {
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
