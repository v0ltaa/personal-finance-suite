import { useState, useRef } from "react";
import { Outlet, useNavigate, useLocation } from "react-router-dom";
import { useTheme } from "./lib/theme";
import { useIsMobile, useAuth } from "./lib/hooks";
import { uploadAvatar, getAvatarUrl } from "./lib/supabase";
import { SUPPORTED_CURRENCIES, currencySymbol, getDisplayCurrency, setDisplayCurrency } from "./lib/currency";
import AuthModal from "./components/AuthModal";
import ScenarioManager from "./components/ScenarioManager";
import { Button } from "./components/ui/button";
import { Select } from "./components/ui/select";
import { cn } from "./lib/utils";
import {
  ListFilter, User, LogOut,
  BarChart2, Home, Map, Calculator, Layers, Wallet
} from "lucide-react";

const modules = [
  { key: "gaffTracker",    label: "Properties",    path: "/gaff",    icon: Home },
  { key: "comparison",     label: "Comparison",    path: "/compare", icon: Layers },
  { key: "mapView",        label: "Map",           path: "/map",     icon: Map },
  { key: "buyVsRent",      label: "Buy Scenario",  path: "/",        icon: Calculator,  wip: true },
  { key: "sandbox",        label: "Rent vs Buy",   path: "/sandbox", icon: BarChart2,   wip: true },
  { key: "financeTracker", label: "Budget Tracker",path: "/finance", icon: Wallet,      wip: true },
];

export default function App() {
  const mobile = useIsMobile();
  const auth = useAuth();
  useTheme(); // ensures ThemeProvider runs its effect
  const navigate = useNavigate();
  const location = useLocation();

  const [showAuth, setShowAuth] = useState(false);
  const [showScenarios, setShowScenarios] = useState(false);
  const [displayCurrency, setDisplayCurrencyState] = useState(getDisplayCurrency);
  const fileInputRef = useRef(null);

  const handleCurrencyChange = (code) => {
    setDisplayCurrency(code);
    setDisplayCurrencyState(code);
    window.dispatchEvent(new StorageEvent("storage", { key: "display_currency", newValue: code }));
  };

  const handleAvatarUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file || !auth.user) return;
    await uploadAvatar(auth.user.id, file);
    window.location.reload();
  };

  const currentPath = location.pathname;
  const isFullWidth = currentPath === "/map" || currentPath === "/compare";

  const avatarUrl = auth.user ? getAvatarUrl(auth.user) : null;
  const avatarInitial = auth.user
    ? (auth.user.user_metadata?.display_name?.[0] || auth.user.email?.[0] || "?").toUpperCase()
    : null;

  return (
    <div className="min-h-screen bg-background font-sans">
      {/* ── Top Header ── */}
      <header className="sticky top-0 z-50 bg-card border-b border-border">
        <div className="flex items-center justify-between px-4 sm:px-6 h-14">
          {/* Logo */}
          <button
            onClick={() => navigate("/")}
            className="font-serif text-xl sm:text-2xl text-foreground tracking-tight hover:text-brand transition-colors duration-150"
          >
            Personal Finance Suite
          </button>

          {/* Right controls */}
          <div className="flex items-center gap-1.5">
            {/* Currency picker */}
            <Select
              value={displayCurrency}
              onChange={(e) => handleCurrencyChange(e.target.value)}
              title="Display currency"
              className="w-auto text-xs h-8 pr-7 pl-2.5"
            >
              {SUPPORTED_CURRENCIES.map((code) => (
                <option key={code} value={code}>{currencySymbol(code)} {code}</option>
              ))}
            </Select>

            {/* Scenarios */}
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={() => auth.user ? setShowScenarios(true) : setShowAuth(true)}
              title="Scenarios"
            >
              <ListFilter size={15} />
            </Button>

            {/* Auth */}
            {auth.user ? (
              <div className="flex items-center gap-2 ml-1">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleAvatarUpload}
                  className="hidden"
                />
                <button
                  onClick={() => fileInputRef.current?.click()}
                  title="Change avatar"
                  className="w-8 h-8 rounded-full border-2 border-border overflow-hidden flex items-center justify-center text-xs font-bold text-white bg-brand hover:ring-2 hover:ring-brand/50 transition-all"
                  style={avatarUrl ? { backgroundImage: `url(${avatarUrl})`, backgroundSize: "cover" } : {}}
                >
                  {!avatarUrl && avatarInitial}
                </button>
                {!mobile && (
                  <span className="text-xs text-muted-foreground max-w-[100px] truncate">
                    {auth.user.user_metadata?.display_name || auth.user.email}
                  </span>
                )}
                <Button variant="ghost" size="icon-sm" onClick={auth.signOut} title="Sign out">
                  <LogOut size={14} />
                </Button>
              </div>
            ) : (
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={() => setShowAuth(true)}
                title="Sign in"
              >
                <User size={15} />
              </Button>
            )}
          </div>
        </div>

        {/* ── Navigation tabs ── */}
        <nav className="flex overflow-x-auto scrollbar-thin px-4 sm:px-6 border-t border-border">
          {modules.map((m) => {
            const isActive = m.path === currentPath || (m.path === "/" && currentPath === "");
            const Icon = m.icon;
            return (
              <button
                key={m.key}
                onClick={() => navigate(m.path)}
                className={cn(
                  "flex items-center gap-1.5 whitespace-nowrap px-4 py-3 text-sm font-medium",
                  "border-b-2 transition-all duration-150 -mb-px",
                  isActive
                    ? "border-brand text-brand"
                    : "border-transparent text-muted-foreground hover:text-foreground hover:border-border"
                )}
              >
                <Icon size={14} />
                {m.label}
                {m.wip && (
                  <span className="text-[9px] font-semibold tracking-wide uppercase text-muted-foreground/60 leading-none">
                    WIP
                  </span>
                )}
              </button>
            );
          })}
        </nav>
      </header>

      {/* ── Page content ── */}
      <main className={isFullWidth ? "" : "max-w-5xl mx-auto px-4 sm:px-6 py-8"}>
        <Outlet />
      </main>

      {/* ── Modals ── */}
      {showAuth && <AuthModal onClose={() => setShowAuth(false)} auth={auth} />}
      {showScenarios && <ScenarioManager onClose={() => setShowScenarios(false)} />}
    </div>
  );
}
