import React from "react";
import ReactDOM from "react-dom/client";
import "./index.css";
import "leaflet/dist/leaflet.css";
import "react-easy-crop/react-easy-crop.css";
import { HashRouter, Routes, Route, Navigate } from "react-router-dom";
import { ThemeProvider } from "./lib/theme";
import App from "./App";
import BuyVsRent from "./pages/BuyVsRent";
import Sandbox from "./pages/Sandbox";
import GaffTracker from "./pages/GaffTracker";
import PropertyComparison from "./pages/PropertyComparison";
import MapView from "./pages/MapView";
import FinanceTracker from "./pages/FinanceTracker";
import BudgetDesigner from "./pages/BudgetDesigner";
import PortfolioLayout from "./pages/portfolio/PortfolioLayout";
import StocksPage from "./pages/portfolio/StocksPage";
import PortfolioPage from "./pages/portfolio/PortfolioPage";
import IndicatorPage from "./pages/portfolio/IndicatorPage";
import SandboxPage from "./pages/portfolio/SandboxPage";

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
          <Route path="budget" element={<BudgetDesigner />} />
          <Route path="portfolio-strategy" element={<PortfolioLayout />}>
            <Route index element={<Navigate to="stocks" replace />} />
            <Route path="stocks"    element={<StocksPage />} />
            <Route path="portfolio" element={<PortfolioPage />} />
            <Route path="indicator" element={<IndicatorPage />} />
            <Route path="sandbox"   element={<SandboxPage />} />
          </Route>
        </Route>
      </Routes>
    </HashRouter>
    </ThemeProvider>
  </React.StrictMode>
);
