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

  useEffect(() => { setMobileOpen(false); setUserOpen(false); }, [pathname]);

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
      'px-4 py-2 text-[13px] font-medium tracking-wide uppercase transition-all duration-300',
      isActive
        ? 'text-white'
        : 'text-mono-500 hover:text-white'
    );

  const aiLinkClass = ({ isActive }: { isActive: boolean }) =>
    cx(
      'inline-flex items-center gap-2 px-4 py-2 text-[13px] font-semibold tracking-wide uppercase border rounded-full transition-all duration-300',
      isActive
        ? 'border-white text-white bg-white/5'
        : 'border-mono-300/20 text-mono-600 hover:border-white/40 hover:text-white'
    );

  const Brand = () => (
    <Link to="/" className="group flex items-center gap-3">
      <img
        src={logoUrl}
        alt="SBU VibeCheck"
        className="h-8 w-8 rounded-lg object-cover grayscale brightness-110 contrast-125"
        loading="eager"
        decoding="sync"
      />
      <span className="text-[15px] font-bold tracking-tight text-white">
        SBU <span className="text-mono-600">Vibe</span>Check
      </span>
    </Link>
  );

  const AuthControls = () => {
    if (isLoading) {
      return (
        <span className="inline-flex items-center gap-2 px-3 py-2 text-xs text-mono-500">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading…
        </span>
      );
    }
    if (!isAuthenticated) {
      return (
        <button
          onClick={login}
          className="inline-flex items-center gap-2 rounded-full border border-white/20 px-4 py-2 text-[13px] font-semibold text-white transition-all hover:bg-white hover:text-black"
        >
          <LogIn size={14} /> Log In
        </button>
      );
    }
    return (
      <div className="relative">
        <button
          ref={userBtnRef}
          onClick={() => setUserOpen((v) => !v)}
          className={cx(
            'inline-flex items-center gap-2 rounded-full border border-transparent px-3 py-2 text-[13px] text-mono-600 transition-all hover:border-white/10 hover:text-white',
            userOpen && 'border-white/10 text-white'
          )}
          aria-expanded={userOpen}
          aria-haspopup="menu"
        >
          <span className="flex h-7 w-7 items-center justify-center rounded-full border border-white/10 bg-mono-100">
            <User size={14} />
          </span>
          <span className="hidden sm:inline">Account</span>
          <ChevronDown size={12} className={cx('transition-transform', userOpen && 'rotate-180')} />
        </button>

        {userOpen && (
          <div
            ref={userMenuRef}
            role="menu"
            className="absolute right-0 z-50 mt-2 w-48 overflow-hidden rounded-2xl border border-white/10 bg-mono-50 shadow-2xl vol-shadow-lg"
          >
            <Link
              to="/profile/me"
              onClick={() => setUserOpen(false)}
              className="flex items-center gap-3 px-4 py-3 text-[13px] text-mono-700 transition-colors hover:bg-white/5 hover:text-white"
              role="menuitem"
            >
              <User size={14} /> My Profile
            </Link>
            <div className="mx-3 h-px bg-white/5" />
            <button
              onClick={() => { setUserOpen(false); logout(); }}
              className="flex w-full items-center gap-3 px-4 py-3 text-left text-[13px] text-mono-500 transition-colors hover:bg-white/5 hover:text-white"
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
      <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-md focus:bg-white focus:px-3 focus:py-2 focus:text-black">
        Skip to content
      </a>

      <header className="sticky top-0 z-40 w-full border-b border-white/[0.06] bg-black/80 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-3 sm:px-6">
          {/* Left */}
          <div className="flex min-w-0 items-center gap-4">
            <button
              className="inline-flex items-center justify-center rounded-lg p-2 text-mono-500 transition-colors hover:bg-white/5 hover:text-white sm:hidden"
              onClick={() => setMobileOpen((v) => !v)}
              aria-label="Toggle navigation"
              aria-expanded={mobileOpen}
            >
              {mobileOpen ? <X size={20} /> : <Menu size={20} />}
            </button>

            <Brand />

            <nav className="ml-4 hidden items-center gap-1 sm:flex">
              <NavLink to="/ai" className={aiLinkClass}>
                <Wand2 size={14} />
                Ask AI
              </NavLink>
              <NavLink to="/chat" className={navLinkClass}>
                Chat
              </NavLink>
            </nav>
          </div>

          {/* Right */}
          <div className="flex items-center gap-3">
            {isAuthenticated && role === 'organizer' && (
              <Link
                to="/events/new"
                className="hidden items-center gap-2 rounded-full border border-white/20 px-4 py-2 text-[13px] font-semibold text-white transition-all hover:bg-white hover:text-black sm:flex"
                title="Create New Event"
              >
                <PlusCircle size={14} />
                Create
              </Link>
            )}

            {isAuthenticated && role && (
              <span
                className="hidden rounded-full border border-white/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-widest text-mono-500 sm:inline"
                title={`Signed in as ${role}`}
              >
                {role}
              </span>
            )}

            <AuthControls />
          </div>
        </div>

        {/* Mobile drawer */}
        {mobileOpen && (
          <div className="border-t border-white/[0.06] bg-black sm:hidden">
            <div className="mx-auto max-w-7xl px-4 py-4">
              <nav className="flex flex-col gap-1">
                <NavLink to="/ai" className={aiLinkClass} onClick={() => setMobileOpen(false)}>
                  <Wand2 size={14} /> Ask AI
                </NavLink>
                <NavLink to="/chat" className={navLinkClass} onClick={() => setMobileOpen(false)}>
                  Chat
                </NavLink>
                {isAuthenticated && role === 'organizer' && (
                  <Link
                    to="/events/new"
                    onClick={() => setMobileOpen(false)}
                    className="mt-2 inline-flex items-center gap-2 rounded-full border border-white/20 px-4 py-2 text-[13px] font-semibold text-white transition-all hover:bg-white hover:text-black"
                  >
                    <PlusCircle size={14} /> Create Event
                  </Link>
                )}
              </nav>
            </div>
          </div>
        )}
      </header>
    </>
  );
}
