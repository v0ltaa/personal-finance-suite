import { createContext, useContext, useEffect } from "react";
import { _setTheme } from "./tokens";

const ThemeCtx = createContext({ theme: "light", toggleTheme: () => {} });

export function ThemeProvider({ children }) {
  useEffect(() => {
    // Force light mode, clear any stored dark preference
    _setTheme("light");
    localStorage.removeItem("theme");
    document.documentElement.classList.remove("dark");
  }, []);

  return (
    <ThemeCtx.Provider value={{ theme: "light", toggleTheme: () => {} }}>
      {children}
    </ThemeCtx.Provider>
  );
}

export const useTheme = () => useContext(ThemeCtx);
