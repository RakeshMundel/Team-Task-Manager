import React from "react";
import { createRoot } from "react-dom/client";
import {
  CheckCircle2,
  ClipboardList,
  FolderKanban,
  LogOut,
  Plus,
  Search,
  UserPlus,
  Users
} from "lucide-react";
import "./styles.css";

const statusLabels = {
  TODO: "To do",
  IN_PROGRESS: "In progress",
  DONE: "Done"
};

const emptyTask = {
  title: "",
  description: "",
  assigneeId: "",
  status: "TODO",
  dueDate: ""
};

function App() {
  const [token, setToken] = React.useState(() => localStorage.getItem("tm_token"));
  const [user, setUser] = React.useState(null);
  const [authMode, setAuthMode] = React.useState("login");
  const [authForm, setAuthForm] = React.useState({ name: "", email: "", password: "" });
  const [authMessage, setAuthMessage] = React.useState("");
  const [projects, setProjects] = React.useState([]);
  const [selectedProjectId, setSelectedProjectId] = React.useState("");
  const [members, setMembers] = React.useState([]);
  const [tasks, setTasks] = React.useState([]);
  const [dashboard, setDashboard] = React.useState({});
  const [filter, setFilter] = React.useState("ALL");
  const [toast, setToast] = React.useState("");
  const [projectForm, setProjectForm] = React.useState({ name: "", description: "" });
  const [memberForm, setMemberForm] = React.useState({ email: "", role: "MEMBER" });
  const [taskForm, setTaskForm] = React.useState(emptyTask);
  const [taskEditingId, setTaskEditingId] = React.useState("");
  const [dialog, setDialog] = React.useState(null);

  const selectedProject = projects.find((project) => project.id === selectedProjectId);
  const canAdmin = selectedProject?.member_role === "ADMIN";
  const visibleTasks = filter === "ALL" ? tasks : tasks.filter((task) => task.status === filter);

  const notify = React.useCallback((message) => {
    setToast(message);
    window.setTimeout(() => setToast(""), 3200);
  }, []);

  const api = React.useCallback(
    async (path, options = {}) => {
      const response = await fetch(path, {
        ...options,
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
          ...(options.headers || {})
        }
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "Request failed");
      return data;
    },
    [token]
  );

  const loadProjectDetails = React.useCallback(
    async (projectId) => {
      if (!projectId) {
        setMembers([]);
        setTasks([]);
        return;
      }
      const [membersData, tasksData] = await Promise.all([
        api(`/api/projects/${projectId}/members`),
        api(`/api/projects/${projectId}/tasks`)
      ]);
      setMembers(membersData.members);
      setTasks(tasksData.tasks);
    },
    [api]
  );

  const loadApp = React.useCallback(
    async (projectId = selectedProjectId) => {
      const [projectsData, dashboardData] = await Promise.all([api("/api/projects"), api("/api/dashboard")]);
      const nextProjects = projectsData.projects;
      const nextSelectedId = projectId || nextProjects[0]?.id || "";
      setProjects(nextProjects);
      setDashboard(dashboardData.dashboard);
      setSelectedProjectId(nextSelectedId);
      await loadProjectDetails(nextSelectedId);
    },
    [api, loadProjectDetails, selectedProjectId]
  );

  React.useEffect(() => {
    if (!token) return;
    api("/api/me")
      .then((data) => {
        setUser(data.user);
        return loadApp();
      })
      .catch(() => {
        localStorage.removeItem("tm_token");
        setToken(null);
        setUser(null);
      });
  }, [api, loadApp, token]);

  async function handleAuth(event) {
    event.preventDefault();
    setAuthMessage("");
    try {
      const payload = {
        email: authForm.email,
        password: authForm.password
      };
      if (authMode === "signup") payload.name = authForm.name;
      const data = await api(`/api/auth/${authMode}`, {
        method: "POST",
        body: JSON.stringify(payload)
      });
      localStorage.setItem("tm_token", data.token);
      setToken(data.token);
      setUser(data.user);
    } catch (error) {
      setAuthMessage(error.message);
    }
  }

  function logout() {
    localStorage.removeItem("tm_token");
    setToken(null);
    setUser(null);
    setProjects([]);
    setSelectedProjectId("");
  }

  async function createProject(event) {
    event.preventDefault();
    try {
      const data = await api("/api/projects", {
        method: "POST",
        body: JSON.stringify(projectForm)
      });
      setProjectForm({ name: "", description: "" });
      setDialog(null);
      await loadApp(data.project.id);
      notify("Project created");
    } catch (error) {
      notify(error.message);
    }
  }

  async function saveMember(event) {
    event.preventDefault();
    try {
      await api(`/api/projects/${selectedProjectId}/members`, {
        method: "POST",
        body: JSON.stringify(memberForm)
      });
      setMemberForm({ email: "", role: "MEMBER" });
      setDialog(null);
      await loadProjectDetails(selectedProjectId);
      notify("Member saved");
    } catch (error) {
      notify(error.message);
    }
  }

  async function saveTask(event) {
    event.preventDefault();
    const payload = {
      title: taskForm.title,
      description: taskForm.description,
      assigneeId: taskForm.assigneeId || null,
      status: taskForm.status,
      dueDate: taskForm.dueDate || null
    };
    const path = taskEditingId ? `/api/tasks/${taskEditingId}` : `/api/projects/${selectedProjectId}/tasks`;
    try {
      await api(path, {
        method: taskEditingId ? "PATCH" : "POST",
        body: JSON.stringify(payload)
      });
      setTaskForm(emptyTask);
      setTaskEditingId("");
      setDialog(null);
      await loadApp(selectedProjectId);
      notify("Task saved");
    } catch (error) {
      notify(error.message);
    }
  }

  async function updateTaskStatus(taskId, status) {
    try {
      await api(`/api/tasks/${taskId}`, {
        method: "PATCH",
        body: JSON.stringify({ status })
      });
      await loadApp(selectedProjectId);
    } catch (error) {
      notify(error.message);
    }
  }

  function openTaskDialog(task) {
    if (task) {
      setTaskEditingId(task.id);
      setTaskForm({
        title: task.title,
        description: task.description || "",
        assigneeId: task.assignee_id || "",
        status: task.status,
        dueDate: task.due_date || ""
      });
    } else {
      setTaskEditingId("");
      setTaskForm(emptyTask);
    }
    setDialog("task");
  }

  if (!token || !user) {
    return (
      <main className="auth-screen">
        <section className="auth-copy">
          <div className="logo-mark">
            <ClipboardList size={30} />
          </div>
          <p className="eyebrow">Team delivery</p>
          <h1>Team Task Manager</h1>
          <p>Plan projects, assign owners, and keep status visible across your workspace.</p>
        </section>

        <form className="auth-card" onSubmit={handleAuth}>
          <div className="segmented">
            <button className={authMode === "login" ? "active" : ""} type="button" onClick={() => setAuthMode("login")}>
              Login
            </button>
            <button className={authMode === "signup" ? "active" : ""} type="button" onClick={() => setAuthMode("signup")}>
              Signup
            </button>
          </div>
          {authMode === "signup" && (
            <label>
              Name
              <input value={authForm.name} onChange={(event) => setAuthForm({ ...authForm, name: event.target.value })} />
            </label>
          )}
          <label>
            Email
            <input type="email" value={authForm.email} onChange={(event) => setAuthForm({ ...authForm, email: event.target.value })} />
          </label>
          <label>
            Password
            <input type="password" value={authForm.password} onChange={(event) => setAuthForm({ ...authForm, password: event.target.value })} />
          </label>
          <button className="primary" type="submit">Continue</button>
          {authMessage && <p className="form-message">{authMessage}</p>}
        </form>
      </main>
    );
  }

  return (
    <main className="app-shell">
      <aside className="sidebar">
        <div className="sidebar-head">
          <div className="logo-mark small-mark">
            <FolderKanban size={20} />
          </div>
          <div>
            <p className="eyebrow">Workspace</p>
            <h2>Projects</h2>
          </div>
        </div>
        <button className="primary icon-button" type="button" onClick={() => setDialog("project")}>
          <Plus size={18} /> Project
        </button>
        <div className="project-list">
          {projects.length ? (
            projects.map((project) => (
              <button
                className={`project-item ${project.id === selectedProjectId ? "active" : ""}`}
                key={project.id}
                type="button"
                onClick={async () => {
                  setSelectedProjectId(project.id);
                  await loadProjectDetails(project.id);
                }}
              >
                <strong>{project.name}</strong>
                <span>{project.done_count || 0}/{project.task_count || 0} done · {project.member_role}</span>
              </button>
            ))
          ) : (
            <p className="empty-text">Create your first project.</p>
          )}
        </div>
        <button className="ghost icon-button" type="button" onClick={logout}>
          <LogOut size={18} /> Logout
        </button>
      </aside>

      <section className="content">
        <header className="topbar">
          <div>
            <p className="eyebrow">{user.name} · {user.role}</p>
            <h1>{selectedProject?.name || "Dashboard"}</h1>
          </div>
          <div className="toolbar">
            {canAdmin && (
              <>
                <button className="secondary icon-button" type="button" onClick={() => setDialog("member")}>
                  <UserPlus size={18} /> Member
                </button>
                <button className="primary icon-button" type="button" onClick={() => openTaskDialog()}>
                  <Plus size={18} /> Task
                </button>
              </>
            )}
          </div>
        </header>

        <section className="metrics">
          <Metric icon={<ClipboardList size={20} />} label="Total" value={dashboard.total || 0} />
          <Metric icon={<Search size={20} />} label="To do" value={dashboard.todo || 0} />
          <Metric icon={<FolderKanban size={20} />} label="In progress" value={dashboard.in_progress || 0} />
          <Metric icon={<CheckCircle2 size={20} />} label="Done" value={dashboard.done || 0} />
          <Metric icon={<Users size={20} />} label="Open assigned" value={dashboard.assigned_open || 0} />
        </section>

        <section className="work-grid">
          <div className="panel">
            <div className="panel-heading">
              <h2>Tasks</h2>
              <select value={filter} onChange={(event) => setFilter(event.target.value)}>
                <option value="ALL">All statuses</option>
                <option value="TODO">To do</option>
                <option value="IN_PROGRESS">In progress</option>
                <option value="DONE">Done</option>
              </select>
            </div>
            <div className="task-list">
              {visibleTasks.length ? (
                visibleTasks.map((task) => (
                  <TaskCard
                    canAdmin={canAdmin}
                    key={task.id}
                    task={task}
                    userId={user.id}
                    onEdit={() => openTaskDialog(task)}
                    onStatus={(status) => updateTaskStatus(task.id, status)}
                  />
                ))
              ) : (
                <p className="empty-state">{selectedProject ? "No tasks match this view." : "Select or create a project."}</p>
              )}
            </div>
          </div>

          <div className="panel">
            <div className="panel-heading">
              <h2>Team</h2>
            </div>
            <div className="member-list">
              {members.length ? (
                members.map((member) => (
                  <article className="member-card" key={member.id}>
                    <strong>{member.name}</strong>
                    <span>{member.email}</span>
                    <small>{member.project_role} in project · {member.role} globally</small>
                  </article>
                ))
              ) : (
                <p className="empty-state">No project members yet.</p>
              )}
            </div>
          </div>
        </section>
      </section>

      {dialog === "project" && (
        <Modal title="New project" onClose={() => setDialog(null)}>
          <form onSubmit={createProject}>
            <label>
              Name
              <input required value={projectForm.name} onChange={(event) => setProjectForm({ ...projectForm, name: event.target.value })} />
            </label>
            <label>
              Description
              <textarea value={projectForm.description} onChange={(event) => setProjectForm({ ...projectForm, description: event.target.value })} />
            </label>
            <DialogActions onClose={() => setDialog(null)} submitLabel="Create" />
          </form>
        </Modal>
      )}

      {dialog === "member" && (
        <Modal title="Add member" onClose={() => setDialog(null)}>
          <form onSubmit={saveMember}>
            <label>
              User email
              <input type="email" required value={memberForm.email} onChange={(event) => setMemberForm({ ...memberForm, email: event.target.value })} />
            </label>
            <label>
              Project role
              <select value={memberForm.role} onChange={(event) => setMemberForm({ ...memberForm, role: event.target.value })}>
                <option value="MEMBER">Member</option>
                <option value="ADMIN">Admin</option>
              </select>
            </label>
            <DialogActions onClose={() => setDialog(null)} submitLabel="Save" />
          </form>
        </Modal>
      )}

      {dialog === "task" && (
        <Modal title={taskEditingId ? "Edit task" : "New task"} onClose={() => setDialog(null)}>
          <form onSubmit={saveTask}>
            <label>
              Title
              <input required value={taskForm.title} onChange={(event) => setTaskForm({ ...taskForm, title: event.target.value })} />
            </label>
            <label>
              Description
              <textarea value={taskForm.description} onChange={(event) => setTaskForm({ ...taskForm, description: event.target.value })} />
            </label>
            <label>
              Assignee
              <select value={taskForm.assigneeId} onChange={(event) => setTaskForm({ ...taskForm, assigneeId: event.target.value })}>
                <option value="">Unassigned</option>
                {members.map((member) => (
                  <option key={member.id} value={member.id}>{member.name}</option>
                ))}
              </select>
            </label>
            <label>
              Status
              <select value={taskForm.status} onChange={(event) => setTaskForm({ ...taskForm, status: event.target.value })}>
                <option value="TODO">To do</option>
                <option value="IN_PROGRESS">In progress</option>
                <option value="DONE">Done</option>
              </select>
            </label>
            <label>
              Due date
              <input type="date" value={taskForm.dueDate} onChange={(event) => setTaskForm({ ...taskForm, dueDate: event.target.value })} />
            </label>
            <DialogActions onClose={() => setDialog(null)} submitLabel="Save" />
          </form>
        </Modal>
      )}

      {toast && <div className="toast">{toast}</div>}
    </main>
  );
}

function Metric({ icon, label, value }) {
  return (
    <article className="metric">
      <span>{icon}</span>
      <strong>{value}</strong>
      <small>{label}</small>
    </article>
  );
}

function TaskCard({ canAdmin, onEdit, onStatus, task, userId }) {
  const overdue = task.due_date && task.status !== "DONE" && task.due_date < new Date().toISOString().slice(0, 10);
  const canStatus = canAdmin || task.assignee_id === userId;

  return (
    <article className="task-card">
      <header>
        <h3>{task.title}</h3>
        <span className={`status ${task.status}`}>{statusLabels[task.status]}</span>
      </header>
      {task.description && <p>{task.description}</p>}
      <div className="task-meta">
        <span>{task.assignee_name || "Unassigned"}</span>
        <span className={overdue ? "overdue" : ""}>{task.due_date || "No date"}</span>
      </div>
      <div className="task-actions">
        {canStatus && (
          <select value={task.status} onChange={(event) => onStatus(event.target.value)}>
            <option value="TODO">To do</option>
            <option value="IN_PROGRESS">In progress</option>
            <option value="DONE">Done</option>
          </select>
        )}
        {canAdmin && <button className="secondary" type="button" onClick={onEdit}>Edit</button>}
      </div>
    </article>
  );
}

function Modal({ children, onClose, title }) {
  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={onClose}>
      <section className="modal" role="dialog" aria-modal="true" aria-label={title} onMouseDown={(event) => event.stopPropagation()}>
        <h2>{title}</h2>
        {children}
      </section>
    </div>
  );
}

function DialogActions({ onClose, submitLabel }) {
  return (
    <div className="dialog-actions">
      <button className="ghost" type="button" onClick={onClose}>Cancel</button>
      <button className="primary" type="submit">{submitLabel}</button>
    </div>
  );
}

createRoot(document.getElementById("root")).render(<App />);
