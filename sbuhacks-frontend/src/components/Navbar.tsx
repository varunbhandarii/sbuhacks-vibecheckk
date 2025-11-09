import { useEffect, useRef, useState } from 'react';
import { Link, NavLink, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import {
  User,
  PlusCircle,
  Menu,
  X,
  LogOut,
  LogIn,
  ChevronDown,
  Loader2,
  Sparkles,
  Wand2,
} from 'lucide-react';
import logoUrl from '../assets/logo.png';

function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(' ');
}

export default function Navbar() {
  const { isLoading, isAuthenticated, login, logout, role } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [userOpen, setUserOpen] = useState(false);
  const userBtnRef = useRef<HTMLButtonElement | null>(null);
  const userMenuRef = useRef<HTMLDivElement | null>(null);
  const { pathname } = useLocation();

  useEffect(() => {
    setMobileOpen(false);
    setUserOpen(false);
  }, [pathname]);

  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (!userOpen) return;
      const t = e.target as Node;
      if (userMenuRef.current?.contains(t) || userBtnRef.current?.contains(t)) return;
      setUserOpen(false);
    }
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, [userOpen]);

  const navLinkClass = ({ isActive }: { isActive: boolean }) =>
    cx(
      'rounded-md px-3 py-2 text-sm font-medium transition-colors',
      isActive ? 'bg-gray-800 text-white' : 'text-gray-300 hover:text-white hover:bg-gray-800'
    );

  // Special styling for the AI CTA
  const aiLinkClass = ({ isActive }: { isActive: boolean }) =>
    cx(
      'rounded-md px-3 py-2 text-sm font-semibold ring-1 transition-all',
      isActive
        ? 'bg-gradient-to-r from-fuchsia-600 to-violet-600 text-white ring-white/10 shadow'
        : 'bg-fuchsia-700/20 text-fuchsia-200 ring-fuchsia-800/40 hover:bg-fuchsia-700/30 hover:text-white'
    );

const Brand = () => (
  <Link to="/" className="group flex items-center gap-2">
    <img
      src={logoUrl}
      alt="SBU VibeCheck"
      className="h-8 w-8 rounded-md object-cover shadow-sm ring-1 ring-white/10"
      loading="eager"
      decoding="sync"
    />
    <span className="font-bold tracking-tight">
      SBU <span className="text-rose-300">Vibe</span>Check
    </span>
    <span className="ml-2 hidden rounded-full bg-rose-900/40 px-2 py-0.5 text-[10px] font-semibold text-rose-200 ring-1 ring-rose-700/50 sm:inline">
      Beta
    </span>
  </Link>
);

  const AuthControls = () => {
    if (isLoading) {
      return (
        <span className="inline-flex items-center gap-2 rounded-md bg-gray-800 px-3 py-2 text-xs text-gray-300">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading…
        </span>
      );
    }

    if (!isAuthenticated) {
      return (
        <button
          onClick={login}
          className="inline-flex items-center gap-2 rounded-md bg-blue-600 px-3 py-2 text-sm font-semibold text-white transition-colors hover:bg-blue-500"
        >
          <LogIn size={16} /> Log In
        </button>
      );
    }

    return (
      <div className="relative">
        <button
          ref={userBtnRef}
          onClick={() => setUserOpen((v) => !v)}
          className={cx(
            'inline-flex items-center gap-2 rounded-md px-2 py-1.5 text-sm text-gray-200 transition-colors hover:bg-gray-800',
            userOpen && 'bg-gray-800'
          )}
          aria-expanded={userOpen}
          aria-haspopup="menu"
        >
          <span className="mr-1 rounded-full bg-gray-700 p-1">
            <User size={16} />
          </span>
          <span className="hidden sm:inline">Account</span>
          <ChevronDown size={14} className={cx('transition-transform', userOpen && 'rotate-180')} />
        </button>

        {userOpen && (
          <div
            ref={userMenuRef}
            role="menu"
            className="absolute right-0 z-50 mt-2 w-44 rounded-md border border-gray-800 bg-gray-900/95 p-1 shadow-xl backdrop-blur"
          >
            <Link
              to="/profile/me"
              onClick={() => setUserOpen(false)}
              className="flex items-center gap-2 rounded px-2 py-2 text-sm text-gray-200 hover:bg-gray-800"
              role="menuitem"
            >
              <User size={14} /> My Profile
            </Link>
            <button
              onClick={() => {
                setUserOpen(false);
                logout();
              }}
              className="flex w-full items-center gap-2 rounded px-2 py-2 text-left text-sm text-red-300 hover:bg-gray-800"
              role="menuitem"
            >
              <LogOut size={14} /> Log Out
            </button>
          </div>
        )}
      </div>
    );
  };

  return (
    <>
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-md focus:bg-gray-900 focus:px-3 focus:py-2 focus:text-white"
      >
        Skip to content
      </a>

      <header className="sticky top-0 z-40 w-full bg-gray-900/80 backdrop-blur supports-[backdrop-filter]:bg-gray-900/60">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-3 py-3 sm:px-4">
          {/* Left */}
          <div className="flex min-w-0 items-center gap-3">
            <button
              className="inline-flex items-center justify-center rounded-md p-2 text-gray-300 hover:bg-gray-800 hover:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 sm:hidden"
              onClick={() => setMobileOpen((v) => !v)}
              aria-label="Toggle navigation"
              aria-expanded={mobileOpen}
            >
              {mobileOpen ? <X size={20} /> : <Menu size={20} />}
            </button>

            <Brand />

            {/* Desktop nav */}
            <nav className="ml-2 hidden items-center gap-1 sm:flex">
              {/* 🔮 Ask AI CTA (replaces Events) */}
              <NavLink to="/ai" className={aiLinkClass}>
                <span className="inline-flex items-center gap-1.5">
                  <Wand2 size={16} />
                  Ask AI
                </span>
              </NavLink>

              <NavLink to="/chat" className={navLinkClass}>
                Global Chat
              </NavLink>
            </nav>
          </div>

          {/* Right */}
          <div className="flex items-center gap-2">
            {isAuthenticated && role === 'organizer' && (
              <Link
                to="/events/new"
                className="hidden items-center gap-1.5 rounded-md bg-blue-600 px-3 py-2 text-sm font-semibold text-white transition-colors hover:bg-blue-500 sm:flex"
                title="Create New Event"
              >
                <PlusCircle size={16} />
                <span className="hidden sm:inline">Create Event</span>
              </Link>
            )}

            {isAuthenticated && role && (
              <span
                className={cx(
                  'hidden rounded-full px-2.5 py-1 text-xs font-semibold ring-1 sm:inline',
                  role === 'organizer'
                    ? 'bg-emerald-900/40 text-emerald-200 ring-emerald-800/50'
                    : 'bg-cyan-900/40 text-cyan-200 ring-cyan-800/50'
                )}
                title={`Signed in as ${role}`}
              >
                {role}
              </span>
            )}

            <AuthControls />
          </div>
        </div>

        {/* Mobile drawer */}
        {/* Includes the Ask AI CTA */}
        {mobileOpen && (
          <div className="border-t border-gray-800 bg-gray-900/95 sm:hidden">
            <div className="mx-auto max-w-7xl px-3 py-3">
              <nav className="flex flex-col gap-1">
                <NavLink to="/ai" className={aiLinkClass} onClick={() => setMobileOpen(false)}>
                  <span className="inline-flex items-center gap-1.5">
                    <Wand2 size={16} />
                    Ask AI
                  </span>
                </NavLink>
                <NavLink to="/chat" className={navLinkClass} onClick={() => setMobileOpen(false)}>
                  Global Chat
                </NavLink>

                {isAuthenticated && role === 'organizer' && (
                  <Link
                    to="/events/new"
                    onClick={() => setMobileOpen(false)}
                    className="mt-1 inline-flex items-center gap-1.5 rounded-md bg-blue-600 px-3 py-2 text-sm font-semibold text-white transition-colors hover:bg-blue-500"
                  >
                    <PlusCircle size={16} />
                    Create Event
                  </Link>
                )}
              </nav>
            </div>
          </div>
        )}

        <div className="h-px w-full bg-gradient-to-r from-transparent via-gray-800 to-transparent" />
      </header>
    </>
  );
}
