const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "..", "..", ".env") });

const crypto = require("crypto");
const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { z } = require("zod");
const db = require("./db");

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET;
const frontendDistPath = path.join(__dirname, "..", "..", "frontend", "dist");

if (!JWT_SECRET) {
  throw new Error("JWT_SECRET is required.");
}

app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors());
app.use(express.json({ limit: "1mb" }));
app.use(express.static(frontendDistPath));

const signupSchema = z.object({
  name: z.string().trim().min(2).max(120),
  email: z.string().trim().email().max(255).transform((value) => value.toLowerCase()),
  password: z.string().min(8).max(100)
});

const loginSchema = z.object({
  email: z.string().trim().email().transform((value) => value.toLowerCase()),
  password: z.string().min(1)
});

const projectSchema = z.object({
  name: z.string().trim().min(2).max(160),
  description: z.string().trim().max(2000).optional().default("")
});

const taskSchema = z.object({
  title: z.string().trim().min(2).max(180),
  description: z.string().trim().max(3000).optional().default(""),
  assigneeId: z.string().uuid().nullable().optional(),
  status: z.enum(["TODO", "IN_PROGRESS", "DONE"]).optional().default("TODO"),
  dueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional()
});

const taskUpdateSchema = taskSchema.partial().refine((value) => Object.keys(value).length > 0, {
  message: "At least one field must be provided"
});

const memberSchema = z.object({
  email: z.string().trim().email().transform((value) => value.toLowerCase()),
  role: z.enum(["ADMIN", "MEMBER"]).default("MEMBER")
});

function id() {
  return crypto.randomUUID();
}

function signToken(user) {
  return jwt.sign({ sub: user.id, role: user.role, email: user.email }, JWT_SECRET, { expiresIn: "7d" });
}

function publicUser(user) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    createdAt: user.created_at
  };
}

function validate(schema, source = "body") {
  return (req, res, next) => {
    const parsed = schema.safeParse(req[source]);
    if (!parsed.success) {
      return res.status(400).json({
        error: "Validation failed",
        details: parsed.error.issues.map((issue) => ({ path: issue.path.join("."), message: issue.message }))
      });
    }
    req[source] = parsed.data;
    next();
  };
}

async function authenticate(req, res, next) {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;

  if (!token) {
    return res.status(401).json({ error: "Authentication required" });
  }

  try {
    const payload = jwt.verify(token, JWT_SECRET);
    const { rows } = await db.query("SELECT id, name, email, role, created_at FROM users WHERE id = ?", [payload.sub]);
    if (!rows[0]) return res.status(401).json({ error: "Invalid session" });
    req.user = rows[0];
    next();
  } catch {
    res.status(401).json({ error: "Invalid session" });
  }
}

async function getProjectAccess(projectId, userId) {
  const { rows } = await db.query(
    `SELECT p.*, pm.role AS member_role
     FROM projects p
     JOIN project_members pm ON pm.project_id = p.id
     WHERE p.id = ? AND pm.user_id = ?`,
    [projectId, userId]
  );
  return rows[0] || null;
}

function requireProjectAdmin(project) {
  return project.member_role === "ADMIN";
}

app.post("/api/auth/signup", validate(signupSchema), async (req, res, next) => {
  try {
    const existing = await db.query("SELECT COUNT(*) AS total FROM users");
    const role = existing.rows[0].total === 0 ? "ADMIN" : "MEMBER";
    const passwordHash = await bcrypt.hash(req.body.password, 12);
    const userId = id();

    await db.query(
      `INSERT INTO users (id, name, email, password_hash, role)
       VALUES (?, ?, ?, ?, ?)`,
      [userId, req.body.name, req.body.email, passwordHash, role]
    );
    const createdUser = await db.query("SELECT id, name, email, role, created_at FROM users WHERE id = ?", [userId]);

    res.status(201).json({ user: publicUser(createdUser.rows[0]), token: signToken(createdUser.rows[0]) });
  } catch (error) {
    if (error.code === "ER_DUP_ENTRY") return res.status(409).json({ error: "Email is already registered" });
    next(error);
  }
});

app.post("/api/auth/login", validate(loginSchema), async (req, res, next) => {
  try {
    const { rows } = await db.query("SELECT * FROM users WHERE email = ?", [req.body.email]);
    const user = rows[0];
    if (!user || !(await bcrypt.compare(req.body.password, user.password_hash))) {
      return res.status(401).json({ error: "Invalid email or password" });
    }
    res.json({ user: publicUser(user), token: signToken(user) });
  } catch (error) {
    next(error);
  }
});

app.get("/api/me", authenticate, (req, res) => {
  res.json({ user: publicUser(req.user) });
});

app.get("/api/users", authenticate, async (req, res, next) => {
  try {
    const { rows } = await db.query("SELECT id, name, email, role, created_at FROM users ORDER BY name ASC");
    res.json({ users: rows.map(publicUser) });
  } catch (error) {
    next(error);
  }
});

app.get("/api/projects", authenticate, async (req, res, next) => {
  try {
    const { rows } = await db.query(
      `SELECT p.id, p.name, p.description, p.owner_id, p.created_at, pm.role AS member_role,
        COUNT(t.id) AS task_count,
        SUM(CASE WHEN t.status = 'DONE' THEN 1 ELSE 0 END) AS done_count
       FROM projects p
       JOIN project_members pm ON pm.project_id = p.id
       LEFT JOIN tasks t ON t.project_id = p.id
       WHERE pm.user_id = ?
       GROUP BY p.id, p.name, p.description, p.owner_id, p.created_at, pm.role
       ORDER BY p.created_at DESC`,
      [req.user.id]
    );
    res.json({ projects: rows });
  } catch (error) {
    next(error);
  }
});

app.post("/api/projects", authenticate, validate(projectSchema), async (req, res, next) => {
  const client = await db.pool.connect();
  try {
    await client.query("BEGIN");
    const projectId = id();
    await client.query(
      `INSERT INTO projects (id, name, description, owner_id)
       VALUES (?, ?, ?, ?)`,
      [projectId, req.body.name, req.body.description, req.user.id]
    );
    await client.query(
      "INSERT INTO project_members (project_id, user_id, role) VALUES (?, ?, 'ADMIN')",
      [projectId, req.user.id]
    );
    const projectResult = await client.query("SELECT * FROM projects WHERE id = ?", [projectId]);
    await client.query("COMMIT");
    res.status(201).json({ project: { ...projectResult.rows[0], member_role: "ADMIN" } });
  } catch (error) {
    await client.query("ROLLBACK");
    next(error);
  } finally {
    client.release();
  }
});

app.get("/api/projects/:projectId/members", authenticate, async (req, res, next) => {
  try {
    const project = await getProjectAccess(req.params.projectId, req.user.id);
    if (!project) return res.status(404).json({ error: "Project not found" });

    const { rows } = await db.query(
      `SELECT u.id, u.name, u.email, u.role, pm.role AS project_role, pm.created_at
       FROM project_members pm
       JOIN users u ON u.id = pm.user_id
       WHERE pm.project_id = ?
       ORDER BY pm.role ASC, u.name ASC`,
      [req.params.projectId]
    );
    res.json({ members: rows });
  } catch (error) {
    next(error);
  }
});

app.post("/api/projects/:projectId/members", authenticate, validate(memberSchema), async (req, res, next) => {
  try {
    const project = await getProjectAccess(req.params.projectId, req.user.id);
    if (!project) return res.status(404).json({ error: "Project not found" });
    if (!requireProjectAdmin(project)) return res.status(403).json({ error: "Project admin access required" });

    const userResult = await db.query("SELECT id FROM users WHERE email = ?", [req.body.email]);
    const user = userResult.rows[0];
    if (!user) return res.status(404).json({ error: "No user found with that email" });

    await db.query(
      `INSERT INTO project_members (project_id, user_id, role)
       VALUES (?, ?, ?)
       ON DUPLICATE KEY UPDATE role = VALUES(role)`,
      [req.params.projectId, user.id, req.body.role]
    );
    res.status(201).json({ message: "Member saved" });
  } catch (error) {
    next(error);
  }
});

app.get("/api/projects/:projectId/tasks", authenticate, async (req, res, next) => {
  try {
    const project = await getProjectAccess(req.params.projectId, req.user.id);
    if (!project) return res.status(404).json({ error: "Project not found" });

    const { rows } = await db.query(
      `SELECT t.*, u.name AS assignee_name, u.email AS assignee_email
       FROM tasks t
       LEFT JOIN users u ON u.id = t.assignee_id
       WHERE t.project_id = ?
       ORDER BY
        CASE t.status WHEN 'TODO' THEN 1 WHEN 'IN_PROGRESS' THEN 2 ELSE 3 END,
        t.due_date IS NULL ASC,
        t.due_date ASC,
        t.created_at DESC`,
      [req.params.projectId]
    );
    res.json({ tasks: rows });
  } catch (error) {
    next(error);
  }
});

app.post("/api/projects/:projectId/tasks", authenticate, validate(taskSchema), async (req, res, next) => {
  try {
    const project = await getProjectAccess(req.params.projectId, req.user.id);
    if (!project) return res.status(404).json({ error: "Project not found" });
    if (!requireProjectAdmin(project)) return res.status(403).json({ error: "Project admin access required" });

    if (req.body.assigneeId) {
      const access = await getProjectAccess(req.params.projectId, req.body.assigneeId);
      if (!access) return res.status(400).json({ error: "Assignee must be a project member" });
    }

    const taskId = id();
    await db.query(
      `INSERT INTO tasks (id, project_id, title, description, assignee_id, status, due_date, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        taskId,
        req.params.projectId,
        req.body.title,
        req.body.description,
        req.body.assigneeId || null,
        req.body.status,
        req.body.dueDate || null,
        req.user.id
      ]
    );
    const { rows } = await db.query("SELECT * FROM tasks WHERE id = ?", [taskId]);
    res.status(201).json({ task: rows[0] });
  } catch (error) {
    next(error);
  }
});

app.patch("/api/tasks/:taskId", authenticate, validate(taskUpdateSchema), async (req, res, next) => {
  try {
    const taskResult = await db.query("SELECT * FROM tasks WHERE id = ?", [req.params.taskId]);
    const task = taskResult.rows[0];
    if (!task) return res.status(404).json({ error: "Task not found" });

    const project = await getProjectAccess(task.project_id, req.user.id);
    if (!project) return res.status(404).json({ error: "Task not found" });

    const isAdmin = requireProjectAdmin(project);
    const isAssignee = task.assignee_id === req.user.id;
    const onlyStatus = Object.keys(req.body).every((key) => key === "status");
    if (!isAdmin && !(isAssignee && onlyStatus)) {
      return res.status(403).json({ error: "Only project admins can edit tasks; assignees can update status" });
    }

    if (req.body.assigneeId) {
      const access = await getProjectAccess(task.project_id, req.body.assigneeId);
      if (!access) return res.status(400).json({ error: "Assignee must be a project member" });
    }

    const nextTask = {
      title: req.body.title ?? task.title,
      description: req.body.description ?? task.description,
      assigneeId: Object.prototype.hasOwnProperty.call(req.body, "assigneeId") ? req.body.assigneeId : task.assignee_id,
      status: req.body.status ?? task.status,
      dueDate: Object.prototype.hasOwnProperty.call(req.body, "dueDate") ? req.body.dueDate : task.due_date
    };

    await db.query(
      `UPDATE tasks
       SET title = ?, description = ?, assignee_id = ?, status = ?, due_date = ?, updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [nextTask.title, nextTask.description, nextTask.assigneeId, nextTask.status, nextTask.dueDate, req.params.taskId]
    );
    const updatedTask = await db.query("SELECT * FROM tasks WHERE id = ?", [req.params.taskId]);
    res.json({ task: updatedTask.rows[0] });
  } catch (error) {
    next(error);
  }
});

app.get("/api/dashboard", authenticate, async (req, res, next) => {
  try {
    const { rows } = await db.query(
      `SELECT
        COUNT(t.id) AS total,
        SUM(CASE WHEN t.status = 'TODO' THEN 1 ELSE 0 END) AS todo,
        SUM(CASE WHEN t.status = 'IN_PROGRESS' THEN 1 ELSE 0 END) AS in_progress,
        SUM(CASE WHEN t.status = 'DONE' THEN 1 ELSE 0 END) AS done,
        SUM(CASE WHEN t.due_date < CURRENT_DATE AND t.status <> 'DONE' THEN 1 ELSE 0 END) AS overdue,
        SUM(CASE WHEN t.assignee_id = ? AND t.status <> 'DONE' THEN 1 ELSE 0 END) AS assigned_open
       FROM tasks t
       JOIN project_members pm ON pm.project_id = t.project_id
       WHERE pm.user_id = ?`,
      [req.user.id, req.user.id]
    );
    res.json({ dashboard: rows[0] });
  } catch (error) {
    next(error);
  }
});

app.use("/api", (req, res) => {
  res.status(404).json({ error: "API route not found" });
});

app.get("*", (req, res) => {
  res.sendFile(path.join(frontendDistPath, "index.html"));
});

app.use((error, req, res, next) => {
  console.error(error);
  res.status(500).json({ error: "Something went wrong" });
});

app.listen(PORT, () => {
  console.log(`Task Manager running on http://localhost:${PORT}`);
});
