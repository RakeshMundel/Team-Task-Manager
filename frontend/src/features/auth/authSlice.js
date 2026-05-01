const TOKEN_KEY = "tm_token";

export const initialAuthForm = {
  name: "",
  email: "",
  password: ""
};

export function getStoredToken() {
  return localStorage.getItem(TOKEN_KEY);
}

export function saveToken(token) {
  localStorage.setItem(TOKEN_KEY, token);
}

export function clearToken() {
  localStorage.removeItem(TOKEN_KEY);
}
