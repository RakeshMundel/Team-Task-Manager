function TeamPanel({ members }) {
  function initials(name) {
    return name
      .split(" ")
      .map((part) => part[0])
      .join("")
      .slice(0, 2)
      .toUpperCase();
  }

  return (
    <div className="team-panel">
      <div className="panel-heading">
        <h2>Team</h2>
      </div>
      <div className="member-list">
        {members.length ? (
          members.map((member) => (
            <article className="member-card" key={member.id}>
              <div className="member-avatar" aria-hidden="true">{initials(member.name)}</div>
              <div>
                <strong>{member.name}</strong>
                <span>{member.email}</span>
                <small>{member.project_role} in project - {member.role} globally</small>
              </div>
            </article>
          ))
        ) : (
          <p className="empty-state">No project members yet.</p>
        )}
      </div>
    </div>
  );
}

export default TeamPanel;
