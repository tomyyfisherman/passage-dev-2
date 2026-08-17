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
const authSection = document.getElementById('auth-section');
const appSection = document.getElementById('app-section');
const userBox = document.getElementById('user-box');
const userEmailEl = document.getElementById('user-email');

const loginForm = document.getElementById('login-form');
const registerForm = document.getElementById('register-form');
const loginError = document.getElementById('login-error');
const registerError = document.getElementById('register-error');

const taskForm = document.getElementById('task-form');
const taskFormError = document.getElementById('task-form-error');
const taskSubmitBtn = document.getElementById('task-submit-btn');
const taskCancelBtn = document.getElementById('task-cancel-btn');
const taskList = document.getElementById('task-list');
const emptyState = document.getElementById('empty-state');
const filterStatus = document.getElementById('filter-status');

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

// ---- Tabs ----
document.querySelectorAll('.tab-btn').forEach((btn) => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.tab-btn').forEach((b) => b.classList.remove('active'));
    btn.classList.add('active');
    document.querySelectorAll('.tab-panel').forEach((p) => p.classList.add('hidden'));
    document.getElementById(`${btn.dataset.tab}-form`).classList.remove('hidden');
  });
});

// ---- Auth ----
function showApp(user) {
  state.user = user;
  userEmailEl.textContent = user.email;
  userBox.classList.remove('hidden');
  authSection.classList.add('hidden');
  appSection.classList.remove('hidden');
  loadTasks();
}

function showAuth() {
  state.user = null;
  state.token = null;
  localStorage.removeItem('token');
  userBox.classList.add('hidden');
  authSection.classList.remove('hidden');
  appSection.classList.add('hidden');
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
    showApp(data.user);
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
    showApp(data.user);
    registerForm.reset();
  } catch (err) {
    registerError.textContent = err.message;
    registerError.classList.remove('hidden');
  }
});

document.getElementById('logout-btn').addEventListener('click', showAuth);

// ---- Tasks ----
function resetTaskForm() {
  taskForm.reset();
  taskForm.elements.id.value = '';
  state.editingId = null;
  taskSubmitBtn.textContent = 'Ajouter';
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
  } catch (err) {
    if (err.message.includes('Token') || err.message.includes('Authentification')) {
      showAuth();
    }
  }
}

function renderTasks() {
  taskList.innerHTML = '';
  emptyState.classList.toggle('hidden', state.tasks.length > 0);

  for (const task of state.tasks) {
    const li = document.createElement('li');
    li.className = `task-item ${task.status === 'done' ? 'done' : ''}`;

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
        <button class="btn btn-ghost" data-action="edit">Modifier</button>
        <button class="btn btn-danger" data-action="delete">Supprimer</button>
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
  taskSubmitBtn.textContent = 'Enregistrer';
  taskCancelBtn.classList.remove('hidden');
  taskForm.scrollIntoView({ behavior: 'smooth' });
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
  if (!state.token) return showAuth();
  try {
    const data = await api('/auth/me');
    showApp(data.user);
  } catch {
    showAuth();
  }
})();
