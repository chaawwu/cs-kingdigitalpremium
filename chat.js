import { auth, db, storage, ensureAnonymous } from './firebase-config.js';
import { collection, doc, setDoc, addDoc, updateDoc, serverTimestamp, onSnapshot, getDoc, runTransaction } from 'https://www.gstatic.com/firebasejs/9.22.0/firebase-firestore.js';
import { ref as storageRef, uploadBytes, getDownloadURL } from 'https://www.gstatic.com/firebasejs/9.22.0/firebase-storage.js';

// DOM
const startForm = document.getElementById('startForm');
const chatSection = document.getElementById('chatSection');
const intro = document.getElementById('intro');
const messagesEl = document.getElementById('messages');
const messageForm = document.getElementById('messageForm');
const messageInput = document.getElementById('messageInput');
const imageInput = document.getElementById('imageInput');
const queueNumberEl = document.getElementById('queueNumber');
const metaName = document.getElementById('metaName');
const metaProduct = document.getElementById('metaProduct');
const metaOrder = document.getElementById('metaOrder');
const metaStatus = document.getElementById('metaStatus');
const newChatWrap = document.getElementById('newChatWrap');
const newChatBtn = document.getElementById('newChatBtn');

let currentChatId = null;
let unsubscribeMessages = null;
let unsubscribeChat = null;

// Keep chat session in localStorage
function saveSession(chatId, customerToken) {
  localStorage.setItem('kdp_chatId', chatId);
  localStorage.setItem('kdp_customerToken', customerToken);
}

function clearSession() {
  localStorage.removeItem('kdp_chatId');
  localStorage.removeItem('kdp_customerToken');
}

function formatMsg(m) {
  const el = document.createElement('div');
  el.className = 'msg';
  const who = document.createElement('div');
  who.className = 'who';
  who.textContent = m.sender;
  const t = document.createElement('div');
  t.className = 'text';
  if (m.text) t.innerText = m.text;
  if (m.imageUrl) {
    const img = document.createElement('img');
    img.src = m.imageUrl;
    img.className = 'thumb';
    t.appendChild(img);
  }
  el.appendChild(who);
  el.appendChild(t);
  return el;
}

async function startChat(ev) {
  ev.preventDefault();
  // basic validation
  const name = document.getElementById('customerName').value.trim();
  const whatsapp = document.getElementById('whatsapp').value.trim();
  const orderId = document.getElementById('orderId').value.trim();
  const productName = document.getElementById('productName').value.trim();
  const questionType = document.getElementById('questionType').value;
  if (!name || !whatsapp || !orderId || !productName) return alert('Lengkapi data.');

  // ensure anon auth => we use uid as customerToken
  const user = await ensureAnonymous();
  const customerToken = user.uid;

  // create queue number via transaction
  const counterRef = doc(db, 'counters', 'queue');
  const chatIdRef = doc(collection(db, 'chats'));
  await runTransaction(db, async (tx) => {
    const snap = await tx.get(counterRef);
    let last = 50;
    if (snap.exists()) last = snap.data().lastNumber || 50;
    const next = last + 1;
    tx.set(counterRef, { lastNumber: next }, { merge: true });
    const queueNumber = `KDP-CS-${String(next).padStart(4, '0')}`;
    tx.set(chatIdRef, {
      queueNumber,
      customerName: name,
      whatsapp,
      orderId,
      productId: '',
      productName,
      questionType,
      status: 'Menunggu',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      lastCustomerReplyAt: serverTimestamp(),
      lastAdminReplyAt: null,
      closedReason: null,
      customerToken
    });
  });

  // save session and open chat
  saveSession(chatIdRef.id, customerToken);
  openChat(chatIdRef.id);
  intro.classList.add('hidden');
  chatSection.classList.remove('hidden');
}

async function openChat(chatId) {
  // unsubscribe previous
  if (unsubscribeMessages) unsubscribeMessages();
  if (unsubscribeChat) unsubscribeChat();
  currentChatId = chatId;
  const chatRef = doc(db, 'chats', chatId);

  unsubscribeChat = onSnapshot(chatRef, (snap) => {
    if (!snap.exists()) return;
    const d = snap.data();
    queueNumberEl.textContent = d.queueNumber || '';
    metaName.textContent = d.customerName || '';
    metaProduct.textContent = d.productName || '';
    metaOrder.textContent = d.orderId || '';
    metaStatus.textContent = d.status || '';
    if (d.status === 'Selesai') newChatWrap.classList.remove('hidden');
    else newChatWrap.classList.add('hidden');
  });

  const msgsRef = collection(db, 'chats', chatId, 'messages');
  unsubscribeMessages = onSnapshot(msgsRef, (snap) => {
    messagesEl.innerHTML = '';
    snap.docs.forEach(doc => {
      const m = doc.data();
      messagesEl.appendChild(formatMsg(m));
    });
    messagesEl.scrollTop = messagesEl.scrollHeight;
  });
}

async function sendMessage(ev) {
  ev.preventDefault();
  if (!currentChatId) return;
  const text = messageInput.value.trim();
  const file = imageInput.files[0];
  const msgRef = collection(db, 'chats', currentChatId, 'messages');
  const chatRef = doc(db, 'chats', currentChatId);

  let imageUrl = null;
  if (file) {
    // validate file
    const allowed = ['image/jpeg','image/png','image/webp'];
    if (!allowed.includes(file.type)) return alert('Hanya jpg/jpeg/png/webp diperbolehkan');
    if (file.size > 2 * 1024 * 1024) return alert('Maks 2MB');
    const path = `chats/${currentChatId}/${Date.now()}_${file.name}`;
    const sRef = storageRef(storage, path);
    await uploadBytes(sRef, file);
    imageUrl = await getDownloadURL(sRef);
  }

  await addDoc(msgRef, {
    sender: 'customer',
    text: text || null,
    imageUrl: imageUrl || null,
    createdAt: serverTimestamp(),
    read: false
  });

  await updateDoc(chatRef, {
    lastCustomerReplyAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    status: 'Menunggu'
  });

  messageInput.value = '';
  imageInput.value = '';
}

// restore session on load
window.addEventListener('load', async () => {
  const savedChatId = localStorage.getItem('kdp_chatId');
  const token = localStorage.getItem('kdp_customerToken');
  try { await ensureAnonymous(); } catch (e) { console.warn(e); }
  if (savedChatId && token) {
    openChat(savedChatId);
    intro.classList.add('hidden');
    chatSection.classList.remove('hidden');
  }
});

startForm.addEventListener('submit', startChat);
messageForm.addEventListener('submit', sendMessage);
newChatBtn?.addEventListener('click', () => {
  clearSession();
  intro.classList.remove('hidden');
  chatSection.classList.add('hidden');
});
