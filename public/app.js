const STATUS_LABELS = {
  todo: 'À faire',
  in_progress: 'En cours',
  done: 'Terminée',
};

const state = {
  token: localStorage.getItem('token') || null,
  user: null,
  tasks: [],
  editingId: null,
};

// ---- DOM refs ----
const navbar = document.getElementById('navbar');
const navbarBurger = document.getElementById('navbar-burger');
const navDashboardLink = document.getElementById('nav-dashboard-link');
const navbarActionsGuest = document.getElementById('navbar-actions-guest');
const navbarActionsUser = document.getElementById('navbar-actions-user');
const userEmailEl = document.getElementById('user-email');

const views = {
  landing: document.getElementById('view-landing'),
  auth: document.getElementById('view-auth'),
  dashboard: document.getElementById('view-dashboard'),
};

const loginForm = document.getElementById('login-form');
const registerForm = document.getElementById('register-form');
const loginError = document.getElementById('login-error');
const registerError = document.getElementById('register-error');

const taskForm = document.getElementById('task-form');
const taskFormError = document.getElementById('task-form-error');
const taskFormTitle = document.getElementById('task-form-title');
const taskSubmitBtn = document.getElementById('task-submit-btn');
const taskCancelBtn = document.getElementById('task-cancel-btn');
const taskList = document.getElementById('task-list');
const emptyState = document.getElementById('empty-state');
const filterStatus = document.getElementById('filter-status');
const dashboardGreeting = document.getElementById('dashboard-greeting');

// ---- API helper ----
async function api(path, options = {}) {
  const headers = { 'Content-Type': 'application/json', ...(options.headers || {}) };
  if (state.token) headers.Authorization = `Bearer ${state.token}`;

  const res = await fetch(`/api${path}`, { ...options, headers });
  let data = null;
  if (res.status !== 204) {
    data = await res.json().catch(() => null);
  }
  if (!res.ok) {
    const message =
      data?.details?.map((d) => d.message).join('\n') || data?.error || 'Une erreur est survenue.';
    throw new Error(message);
  }
  return data;
}

// ---- View routing ----
function navigateTo(view, options = {}) {
  Object.entries(views).forEach(([name, el]) => {
    el.classList.toggle('hidden', name !== view);
  });
  navbar.classList.remove('menu-open');
  window.scrollTo({ top: 0, behavior: 'instant' in window ? 'instant' : 'auto' });

  if (view === 'auth' && options.tab) {
    setAuthTab(options.tab);
  }
}

document.querySelectorAll('[data-nav]').forEach((el) => {
  el.addEventListener('click', (e) => {
    e.preventDefault();
    const target = el.dataset.nav;
    if (target === 'landing') return navigateTo('landing');
    if (target === 'dashboard') return state.user ? navigateTo('dashboard') : navigateTo('auth', { tab: 'login' });
    if (target === 'auth-login') return navigateTo('auth', { tab: 'login' });
    if (target === 'auth-register') return navigateTo('auth', { tab: 'register' });
  });
});

document.querySelectorAll('[data-scroll-to]').forEach((el) => {
  el.addEventListener('click', (e) => {
    e.preventDefault();
    const targetId = el.dataset.scrollTo;
    navigateTo('landing');
    requestAnimationFrame(() => {
      document.getElementById(targetId)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  });
});

navbarBurger.addEventListener('click', () => {
  navbar.classList.toggle('menu-open');
});

// ---- Auth tabs ----
function setAuthTab(tab) {
  document.querySelectorAll('.tab-btn').forEach((b) => b.classList.toggle('active', b.dataset.tab === tab));
  document.getElementById('login-form').classList.toggle('hidden', tab !== 'login');
  document.getElementById('register-form').classList.toggle('hidden', tab !== 'register');
  document.getElementById('auth-hint-login').classList.toggle('hidden', tab !== 'login');
  document.getElementById('auth-hint-register').classList.toggle('hidden', tab !== 'register');
}

document.querySelectorAll('.tab-btn').forEach((btn) => {
  btn.addEventListener('click', () => setAuthTab(btn.dataset.tab));
});

document.querySelectorAll('[data-tab-link]').forEach((link) => {
  link.addEventListener('click', (e) => {
    e.preventDefault();
    setAuthTab(link.dataset.tabLink);
  });
});

// ---- Auth session ----
function enterApp(user) {
  state.user = user;
  userEmailEl.textContent = user.email;
  dashboardGreeting.textContent = `Bonjour, ${user.email.split('@')[0]} \u{1F44B}`;
  navbarActionsGuest.classList.add('hidden');
  navbarActionsUser.classList.remove('hidden');
  navDashboardLink.classList.remove('hidden');
  navigateTo('dashboard');
  loadTasks();
}

function leaveApp() {
  state.user = null;
  state.token = null;
  localStorage.removeItem('token');
  navbarActionsGuest.classList.remove('hidden');
  navbarActionsUser.classList.add('hidden');
  navDashboardLink.classList.add('hidden');
  navigateTo('landing');
}

loginForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  loginError.classList.add('hidden');
  const formData = new FormData(loginForm);
  try {
    const data = await api('/auth/login', {
      method: 'POST',
      body: JSON.stringify(Object.fromEntries(formData)),
    });
    state.token = data.token;
    localStorage.setItem('token', data.token);
    enterApp(data.user);
    loginForm.reset();
  } catch (err) {
    loginError.textContent = err.message;
    loginError.classList.remove('hidden');
  }
});

registerForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  registerError.classList.add('hidden');
  const formData = new FormData(registerForm);
  try {
    const data = await api('/auth/register', {
      method: 'POST',
      body: JSON.stringify(Object.fromEntries(formData)),
    });
    state.token = data.token;
    localStorage.setItem('token', data.token);
    enterApp(data.user);
    registerForm.reset();
  } catch (err) {
    registerError.textContent = err.message;
    registerError.classList.remove('hidden');
  }
});

document.getElementById('logout-btn').addEventListener('click', leaveApp);

// ---- Tasks ----
function resetTaskForm() {
  taskForm.reset();
  taskForm.elements.id.value = '';
  state.editingId = null;
  taskFormTitle.textContent = 'Nouvelle tâche';
  taskSubmitBtn.textContent = 'Ajouter la tâche';
  taskCancelBtn.classList.add('hidden');
  taskFormError.classList.add('hidden');
}

taskCancelBtn.addEventListener('click', resetTaskForm);

taskForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  taskFormError.classList.add('hidden');

  const formData = new FormData(taskForm);
  const payload = {
    title: formData.get('title'),
    description: formData.get('description'),
    status: formData.get('status'),
    due_date: formData.get('due_date') || null,
  };

  try {
    if (state.editingId) {
      await api(`/tasks/${state.editingId}`, { method: 'PUT', body: JSON.stringify(payload) });
    } else {
      await api('/tasks', { method: 'POST', body: JSON.stringify(payload) });
    }
    resetTaskForm();
    loadTasks();
  } catch (err) {
    taskFormError.textContent = err.message;
    taskFormError.classList.remove('hidden');
  }
});

filterStatus.addEventListener('change', loadTasks);

async function loadTasks() {
  const status = filterStatus.value;
  const query = status ? `?status=${encodeURIComponent(status)}` : '';
  try {
    const data = await api(`/tasks${query}`);
    state.tasks = data.tasks;
    renderTasks();
    updateStats();
  } catch (err) {
    if (err.message.includes('Token') || err.message.includes('Authentification')) {
      leaveApp();
    }
  }
}

function updateStats() {
  const all = state.tasks;
  document.getElementById('stat-total').textContent = all.length;
  document.getElementById('stat-todo').textContent = all.filter((t) => t.status === 'todo').length;
  document.getElementById('stat-progress').textContent = all.filter((t) => t.status === 'in_progress').length;
  document.getElementById('stat-done').textContent = all.filter((t) => t.status === 'done').length;
}

function renderTasks() {
  taskList.innerHTML = '';
  emptyState.classList.toggle('hidden', state.tasks.length > 0);

  for (const task of state.tasks) {
    const li = document.createElement('li');
    li.className = `task-item status-${task.status}`;

    const due = task.due_date ? new Date(task.due_date).toLocaleDateString('fr-FR') : null;

    li.innerHTML = `
      <div>
        <p class="task-title"></p>
        <p class="task-desc"></p>
        <div class="task-meta">
          <span class="badge badge-${task.status}">${STATUS_LABELS[task.status]}</span>
          ${due ? `<span>Échéance : ${due}</span>` : ''}
        </div>
      </div>
      <div class="task-actions">
        <button class="btn btn-ghost btn-sm" data-action="edit">Modifier</button>
        <button class="btn btn-danger btn-sm" data-action="delete">Supprimer</button>
      </div>
    `;
    li.querySelector('.task-title').textContent = task.title;
    li.querySelector('.task-desc').textContent = task.description || '';
    if (!task.description) li.querySelector('.task-desc').classList.add('hidden');

    li.querySelector('[data-action="edit"]').addEventListener('click', () => startEdit(task));
    li.querySelector('[data-action="delete"]').addEventListener('click', () => deleteTask(task.id));

    taskList.appendChild(li);
  }
}

function startEdit(task) {
  state.editingId = task.id;
  taskForm.elements.id.value = task.id;
  taskForm.elements.title.value = task.title;
  taskForm.elements.description.value = task.description || '';
  taskForm.elements.status.value = task.status;
  taskForm.elements.due_date.value = task.due_date ? task.due_date.slice(0, 10) : '';
  taskFormTitle.textContent = 'Modifier la tâche';
  taskSubmitBtn.textContent = 'Enregistrer';
  taskCancelBtn.classList.remove('hidden');
  taskForm.scrollIntoView({ behavior: 'smooth', block: 'center' });
}

async function deleteTask(id) {
  if (!confirm('Supprimer cette tâche ?')) return;
  try {
    await api(`/tasks/${id}`, { method: 'DELETE' });
    if (state.editingId === id) resetTaskForm();
    loadTasks();
  } catch (err) {
    alert(err.message);
  }
}

// ---- Bootstrap ----
(async function init() {
  if (!state.token) return navigateTo('landing');
  try {
    const data = await api('/auth/me');
    enterApp(data.user);
  } catch {
    leaveApp();
  }
})();
