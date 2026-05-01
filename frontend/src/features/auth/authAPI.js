export function getCurrentUser(api) {
  return api("/api/me");
}

export function login(api, payload) {
  return api("/api/auth/login", {
    method: "POST",
    body: JSON.stringify(payload)
  });
}

export function signup(api, payload) {
  return api("/api/auth/signup", {
    method: "POST",
    body: JSON.stringify(payload)
  });
}
