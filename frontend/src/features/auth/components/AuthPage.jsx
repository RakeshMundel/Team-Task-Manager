import React from "react";
import { ClipboardList } from "lucide-react";
import { initialAuthForm } from "../authSlice.js";
import { login, signup } from "../authAPI.js";

function AuthPage({ api, onAuthenticated }) {
  const [authMode, setAuthMode] = React.useState("login");
  const [authForm, setAuthForm] = React.useState(initialAuthForm);
  const [authMessage, setAuthMessage] = React.useState("");

  async function handleAuth(event) {
    event.preventDefault();
    setAuthMessage("");
    try {
      const payload = {
        email: authForm.email,
        password: authForm.password
      };
      const data = authMode === "signup"
        ? await signup(api, { ...payload, name: authForm.name })
        : await login(api, payload);
      onAuthenticated(data);
    } catch (error) {
      setAuthMessage(error.message);
    }
  }

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

export default AuthPage;
