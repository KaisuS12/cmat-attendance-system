// Kept free of zod so client components can share the same rules cheaply.
export interface DayWindows {
  signInStart: string;
  signInEnd: string;
  signOutStart: string;
  signOutEnd: string;
}

// Returns the first ordering problem with a day's windows, or null if valid.
// Shared by create, add-day, and edit so all three enforce the same rules.
export function dayWindowProblem(w: DayWindows): { field: keyof DayWindows; message: string } | null {
  const t = (s: string) => new Date(s).getTime();
  if (t(w.signInEnd) <= t(w.signInStart)) {
    return { field: "signInEnd", message: "Sign-in must end after it starts." };
  }
  if (t(w.signOutEnd) <= t(w.signOutStart)) {
    return { field: "signOutEnd", message: "Sign-out must end after it starts." };
  }
  if (t(w.signOutStart) < t(w.signInStart)) {
    return { field: "signOutStart", message: "Sign-out can't open before sign-in opens." };
  }
  return null;
}
