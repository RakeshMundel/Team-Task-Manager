import { statusLabels } from "../../../shared/utils/taskUtils.js";

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
        <span className={overdue ? "overdue" : ""}>{task.due_date ? new Date(task.due_date).toLocaleDateString() : "No date"}</span>
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

export default TaskCard;
