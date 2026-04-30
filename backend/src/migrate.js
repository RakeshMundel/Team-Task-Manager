const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "..", "..", ".env") });

const { pool, query } = require("./db");

async function migrate() {
  const statements = [
    `
    CREATE TABLE IF NOT EXISTS users (
      id CHAR(36) PRIMARY KEY,
      name VARCHAR(120) NOT NULL,
      email VARCHAR(255) NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      role VARCHAR(20) NOT NULL CHECK (role IN ('ADMIN', 'MEMBER')),
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
    `,
    `
    CREATE TABLE IF NOT EXISTS projects (
      id CHAR(36) PRIMARY KEY,
      name VARCHAR(160) NOT NULL,
      description TEXT NOT NULL,
      owner_id CHAR(36) NOT NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT fk_projects_owner FOREIGN KEY (owner_id) REFERENCES users(id) ON DELETE CASCADE
    )
    `,
    `
    CREATE TABLE IF NOT EXISTS project_members (
      project_id CHAR(36) NOT NULL,
      user_id CHAR(36) NOT NULL,
      role VARCHAR(20) NOT NULL CHECK (role IN ('ADMIN', 'MEMBER')),
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (project_id, user_id),
      CONSTRAINT fk_project_members_project FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
      CONSTRAINT fk_project_members_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )
    `,
    `
    CREATE TABLE IF NOT EXISTS tasks (
      id CHAR(36) PRIMARY KEY,
      project_id CHAR(36) NOT NULL,
      title VARCHAR(180) NOT NULL,
      description TEXT NOT NULL,
      assignee_id CHAR(36),
      status VARCHAR(20) NOT NULL CHECK (status IN ('TODO', 'IN_PROGRESS', 'DONE')),
      due_date DATE,
      created_by CHAR(36),
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      CONSTRAINT fk_tasks_project FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
      CONSTRAINT fk_tasks_assignee FOREIGN KEY (assignee_id) REFERENCES users(id) ON DELETE SET NULL,
      CONSTRAINT fk_tasks_created_by FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL,
      INDEX idx_tasks_project (project_id),
      INDEX idx_tasks_assignee (assignee_id),
      INDEX idx_tasks_status (status)
    )
    `,
    "CREATE INDEX idx_project_members_user ON project_members(user_id)"
  ];

  for (const statement of statements) {
    try {
      await query(statement);
    } catch (error) {
      if (error.code !== "ER_DUP_KEYNAME") throw error;
    }
  }

  console.log("Database migration complete.");
}

migrate()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
