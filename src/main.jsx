import React from "react";
import ReactDOM from "react-dom/client";
import "./index.css";
import "react-easy-crop/react-easy-crop.css";
import { HashRouter, Routes, Route } from "react-router-dom";
import { ThemeProvider } from "./lib/theme";
import App from "./App";
import BuyVsRent from "./pages/BuyVsRent";
import Sandbox from "./pages/Sandbox";
import GaffTracker from "./pages/GaffTracker";
import PropertyComparison from "./pages/PropertyComparison";
import MapView from "./pages/MapView";
import FinanceTracker from "./pages/FinanceTracker";

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <ThemeProvider>
    <HashRouter>
      <Routes>
        <Route element={<App />}>
          <Route index element={<BuyVsRent />} />
          <Route path="sandbox" element={<Sandbox />} />
          <Route path="gaff" element={<GaffTracker />} />
          <Route path="compare" element={<PropertyComparison />} />
          <Route path="map" element={<MapView />} />
          <Route path="finance" element={<FinanceTracker />} />
        </Route>
      </Routes>
    </HashRouter>
    </ThemeProvider>
  </React.StrictMode>
);
