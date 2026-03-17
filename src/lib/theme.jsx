import { createContext, useContext, useState } from "react";
import { _setTheme, _getTheme, darkTheme, lightTheme } from "./tokens";

const ThemeCtx = createContext({ theme: "dark", toggleTheme: () => {} });

export function ThemeProvider({ children }) {
  const [theme, setTheme] = useState(_getTheme);

  const toggleTheme = () => {
    setTheme(t => {
      const next = t === "dark" ? "light" : "dark";
      _setTheme(next);
      localStorage.setItem("theme", next);
      document.body.style.background = (next === "dark" ? darkTheme : lightTheme).bg;
      return next;
    });
  };

  return (
    <ThemeCtx.Provider value={{ theme, toggleTheme }}>
      {children}
    </ThemeCtx.Provider>
  );
}

export const useTheme = () => useContext(ThemeCtx);
