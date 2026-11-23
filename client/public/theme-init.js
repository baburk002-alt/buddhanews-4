/*
 * Applies the saved colour theme before first paint. Kept in an external file
 * so the Content Security Policy can stay at script-src 'self' with no inline
 * script exceptions. Failures (blocked storage) fall back to the light theme.
 */
try {
  if (window.localStorage.getItem("theme") === "dark") {
    document.documentElement.classList.add("dark");
  }
} catch (error) {
  /* storage unavailable */
}
