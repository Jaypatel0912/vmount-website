// Staff login token for /poster and /cycles, kept only for this browser tab.
// Opening the public website ends the login (see main.tsx), so coming back to a
// staff page from the website always asks for the password again.
export const TOKEN_KEY = "vmount-poster-token";

export function clearStaffLogin() {
  try {
    sessionStorage.removeItem(TOKEN_KEY);
  } catch {
    // storage unavailable: nothing stored
  }
}
