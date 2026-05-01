import React from "react";
import AuthPage from "./features/auth/components/AuthPage.jsx";
import { clearToken, getStoredToken, saveToken } from "./features/auth/authSlice.js";
import { getCurrentUser } from "./features/auth/authAPI.js";
import Dashboard from "./features/dashboard/dashboard.jsx";
import { useApi } from "./shared/hooks/useApi.js";

function App() {
  const [token, setToken] = React.useState(getStoredToken);
  const [user, setUser] = React.useState(null);
  const api = useApi(token);

  const logout = React.useCallback(() => {
    clearToken();
    setToken(null);
    setUser(null);
  }, []);

  React.useEffect(() => {
    if (!token) return;
    getCurrentUser(api)
      .then((data) => setUser(data.user))
      .catch(logout);
  }, [api, logout, token]);

  function handleAuthenticated(data) {
    saveToken(data.token);
    setToken(data.token);
    setUser(data.user);
  }

  if (!token || !user) {
    return <AuthPage api={api} onAuthenticated={handleAuthenticated} />;
  }

  return <Dashboard api={api} onLogout={logout} user={user} />;
}

export default App;
