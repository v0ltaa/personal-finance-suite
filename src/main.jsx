import React from "react";
import ReactDOM from "react-dom/client";
import { HashRouter, Routes, Route } from "react-router-dom";
import App from "./App";
import BuyVsRent from "./pages/BuyVsRent";
import Sandbox from "./pages/Sandbox";

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <HashRouter>
      <Routes>
        <Route element={<App />}>
          <Route index element={<BuyVsRent />} />
          <Route path="sandbox" element={<Sandbox />} />
        </Route>
      </Routes>
    </HashRouter>
  </React.StrictMode>
);
