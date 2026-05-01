import { FolderKanban, LogOut, Plus } from "lucide-react";

function ProjectSidebar({ onCreateProject, onLogout, onSelectProject, projects, selectedProjectId }) {
  return (
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
      <button className="primary icon-button" type="button" onClick={onCreateProject}>
        <Plus size={18} /> New Project
      </button>
      <div className="project-list">
        {projects.length ? (
          projects.map((project) => (
            <button
              className={`project-item ${project.id === selectedProjectId ? "active" : ""}`}
              key={project.id}
              type="button"
              onClick={() => onSelectProject(project.id)}
            >
              <strong>{project.name}</strong>
              <span>{project.done_count || 0}/{project.task_count || 0} done - {project.member_role}</span>
            </button>
          ))
        ) : (
          <p className="empty-text">Create your first project.</p>
        )}
      </div>
      <button className="ghost icon-button" type="button" onClick={onLogout}>
        <LogOut size={18} /> Logout
      </button>
    </aside>
  );
}

export default ProjectSidebar;
