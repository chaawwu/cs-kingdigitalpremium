import { auth, db } from './firebase-config.js';
import { signInWithEmailAndPassword, onAuthStateChanged, signOut } from 'https://www.gstatic.com/firebasejs/9.22.0/firebase-auth.js';
import { collection, doc, getDocs, onSnapshot, query, where, orderBy, updateDoc, addDoc, setDoc, deleteDoc, serverTimestamp } from 'https://www.gstatic.com/firebasejs/9.22.0/firebase-firestore.js';

// DOM
const loginForm = document.getElementById('loginForm');
const loginSection = document.getElementById('loginSection');
const dashboardSection = document.getElementById('dashboardSection');
const logoutBtn = document.getElementById('logoutBtn');
const chatsContainer = document.getElementById('chatsContainer');
const adminMessages = document.getElementById('adminMessages');
const adminMessageForm = document.getElementById('adminMessageForm');
const adminMessageInput = document.getElementById('adminMessageInput');
const statusSelect = document.getElementById('statusSelect');
const closeChatBtn = document.getElementById('closeChatBtn');
const searchInput = document.getElementById('searchInput');

const productForm = document.getElementById('productForm');
const productsList = document.getElementById('productsList');

let currentChatId = null;
let chatsUnsub = null;
let messagesUnsub = null;

// Login
loginForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const email = document.getElementById('adminEmail').value.trim();
  const pass = document.getElementById('adminPassword').value;
  try {
    await signInWithEmailAndPassword(auth, email, pass);
  } catch (err) {
    alert('Login gagal: ' + err.message);
  }
});

logoutBtn?.addEventListener('click', async () => {
  await signOut(auth);
});

onAuthStateChanged(auth, user => {
  if (user) {
    // show dashboard
    loginSection.classList.add('hidden');
    dashboardSection.classList.remove('hidden');
    startChatsListener();
    startAutoCloseChecker();
  } else {
    loginSection.classList.remove('hidden');
    dashboardSection.classList.add('hidden');
    if (chatsUnsub) chatsUnsub();
    if (messagesUnsub) messagesUnsub();
  }
});

function startChatsListener() {
  const chatsRef = collection(db, 'chats');
  const q = query(chatsRef, orderBy('createdAt', 'desc'));
  chatsUnsub = onSnapshot(q, snap => {
    chatsContainer.innerHTML = '';
    snap.docs.forEach(d => {
      const c = d.data();
      const el = document.createElement('div');
      el.className = 'chat-item';
      el.innerHTML = `<div class="queue">${c.queueNumber || ''}</div><div class="info"><strong>${c.customerName}</strong><div>${c.productName} • ${c.orderId}</div></div><div class="status ${c.status}">${c.status}</div>`;
      el.addEventListener('click', () => openChat(d.id));
      chatsContainer.appendChild(el);
    });
  });
}

async function openChat(chatId) {
  currentChatId = chatId;
  if (messagesUnsub) messagesUnsub();
  const msgsRef = collection(db, 'chats', chatId, 'messages');
  messagesUnsub = onSnapshot(msgsRef, snap => {
    adminMessages.innerHTML = '';
    snap.docs.forEach(m => {
      const mm = m.data();
      const el = document.createElement('div');
      el.className = 'msg';
      el.innerHTML = `<div class="who">${mm.sender}</div><div class="text">${mm.text || ''}${mm.imageUrl?'<div><img src="'+mm.imageUrl+'" class="thumb"></div>':''}</div>`;
      adminMessages.appendChild(el);
    });
    adminMessages.scrollTop = adminMessages.scrollHeight;
  });
}

adminMessageForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  if (!currentChatId) return alert('Buka chat dulu');
  const text = adminMessageInput.value.trim();
  if (!text) return;
  await addDoc(collection(db, 'chats', currentChatId, 'messages'), {
    sender: 'admin',
    text,
    createdAt: serverTimestamp(),
    read: false
  });
  await updateDoc(doc(db, 'chats', currentChatId), {
    lastAdminReplyAt: serverTimestamp(),
    status: 'Dilayani',
    updatedAt: serverTimestamp()
  });
  adminMessageInput.value = '';
});

statusSelect.addEventListener('change', async () => {
  if (!currentChatId) return;
  await updateDoc(doc(db, 'chats', currentChatId), { status: statusSelect.value, updatedAt: serverTimestamp() });
});

closeChatBtn.addEventListener('click', async () => {
  if (!currentChatId) return;
  await updateDoc(doc(db, 'chats', currentChatId), { status: 'Selesai', closedReason: 'Tutup manual oleh admin', updatedAt: serverTimestamp() });
});

// Products CRUD (basic)
productForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const id = document.getElementById('pId').value.trim();
  const name = document.getElementById('pName').value.trim();
  const price = document.getElementById('pPrice').value.trim();
  const duration = document.getElementById('pDuration').value.trim();
  const status = document.getElementById('pStatus').value;
  const note = document.getElementById('pNote').value.trim();
  if (!id) return alert('ID produk diperlukan');
  await setDoc(doc(db, 'products', id), { productName: name, price, duration, status, note, createdAt: serverTimestamp(), updatedAt: serverTimestamp() });
  productForm.reset();
  loadProducts();
});

async function loadProducts() {
  const snap = await getDocs(collection(db, 'products'));
  productsList.innerHTML = '';
  snap.forEach(d => {
    const p = d.data();
    const el = document.createElement('div');
    el.className = 'product-item';
    el.innerHTML = `<strong>${p.productName}</strong> <div>${p.price} • ${p.duration}</div> <div>${p.status}</div>`;
    const del = document.createElement('button'); del.textContent = 'Hapus'; del.className='btn ghost';
    del.addEventListener('click', async ()=>{ if(confirm('Hapus produk?')) await deleteDoc(doc(db,'products',d.id)); loadProducts(); });
    el.appendChild(del);
    productsList.appendChild(el);
  });
}

// Auto-close checker: jika admin kirim dan customer tidak balas 60s => close
function startAutoCloseChecker() {
  setInterval(async () => {
    const q = query(collection(db, 'chats'));
    const snap = await getDocs(q);
    const now = Date.now();
    snap.forEach(async d => {
      const c = d.data();
      if (c.lastAdminReplyAt && (!c.lastCustomerReplyAt || c.lastCustomerReplyAt.toMillis() < c.lastAdminReplyAt.toMillis())) {
        const since = now - c.lastAdminReplyAt.toMillis();
        if (since > 60 * 1000 && c.status !== 'Selesai') {
          await updateDoc(doc(db, 'chats', d.id), { status: 'Selesai', closedReason: 'Selesai otomatis karena customer tidak merespon.', updatedAt: serverTimestamp() });
        }
      }
    });
  }, 30 * 1000); // run every 30s
}

// search
searchInput?.addEventListener('input', async (e) => {
  const qv = e.target.value.trim().toLowerCase();
  // simple client-side filter: reload all and filter
  const snap = await getDocs(collection(db, 'chats'));
  chatsContainer.innerHTML = '';
  snap.forEach(d => {
    const c = d.data();
    const hay = `${c.queueNumber} ${c.customerName} ${c.whatsapp} ${c.orderId} ${c.productName}`.toLowerCase();
    if (!qv || hay.includes(qv)) {
      const el = document.createElement('div');
      el.className = 'chat-item';
      el.innerHTML = `<div class="queue">${c.queueNumber || ''}</div><div class="info"><strong>${c.customerName}</strong><div>${c.productName} • ${c.orderId}</div></div><div class="status ${c.status}">${c.status}</div>`;
      el.addEventListener('click', () => openChat(d.id));
      chatsContainer.appendChild(el);
    }
  });
});

// initial load
loadProducts();
