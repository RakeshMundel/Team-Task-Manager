import React from "react";
import { CheckCircle2, ClipboardList, FolderKanban, Gem, Plus, Search, UserPlus, Users } from "lucide-react";
import DialogActions from "../../shared/components/DialogActions.jsx";
import Modal from "../../shared/components/Modal.jsx";
import { emptyTask } from "../../shared/utils/taskUtils.js";
import Metric from "./components/Metric.jsx";
import ProjectSidebar from "./components/ProjectSidebar.jsx";
import TaskCard from "./components/TaskCard.jsx";
import TeamPanel from "./components/TeamPanel.jsx";

function Dashboard({ api, onLogout, user }) {
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
    loadApp().catch((error) => notify(error.message));
  }, [loadApp, notify]);

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

  async function selectProject(projectId) {
    setSelectedProjectId(projectId);
    await loadProjectDetails(projectId);
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

  return (
    <main className="app-shell">
      <ProjectSidebar
        onCreateProject={() => setDialog("project")}
        onLogout={onLogout}
        onSelectProject={selectProject}
        projects={projects}
        selectedProjectId={selectedProjectId}
      />

      <section className="content">
        <header className="topbar">
          <div>
            <p className="eyebrow">{user.name} - {user.role}</p>
            <h1>{selectedProject?.name || "Dashboard"}</h1>
          </div>
          <div className="toolbar">
            {canAdmin && (
              <>
                <button className="secondary icon-only" type="button" aria-label="Workspace settings">
                  <Gem size={18} />
                </button>
                <button className="secondary icon-button" type="button" onClick={() => setDialog("member")}>
                  <UserPlus size={18} /> Add Member
                </button>
                <button className="primary icon-button" type="button" onClick={() => openTaskDialog()}>
                  <Plus size={18} /> Add Task
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

          <TeamPanel members={members} />
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

export default Dashboard;
