import React, { useState } from 'react';
import {
  Search,
  Moon,
  Sun,
  Menu,
  Sparkles,
  ChevronDown,
  Command
} from 'lucide-react';
import { cn } from '../../lib/utils';
import { useStore } from '../../store/StoreContext';

export default function Header() {
  const { isDark, setIsDark } = useStore();
  const [searchFocused, setSearchFocused] = useState(false);
  const [profileHover, setProfileHover] = useState(false);

  return (
    <header className={cn(
      "relative h-20 flex items-center justify-between px-6 md:px-8 sticky top-0 z-40 transition-all duration-300",
      "bg-white/60 backdrop-blur-2xl",
      "border-b border-white/40",
      "shadow-[0_4px_30px_rgba(99,102,241,0.08)]"
    )}>
      {/* Decorative gradient blobs matching dashboard theme */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-20 right-1/4 w-64 h-64 bg-gradient-to-br from-blue-200/20 to-violet-200/15 rounded-full blur-3xl"></div>
        <div className="absolute -top-20 left-1/3 w-48 h-48 bg-gradient-to-br from-indigo-200/15 to-cyan-200/10 rounded-full blur-2xl"></div>
      </div>

      {/* ═══════════════ LEFT: Mobile Menu + Search ═══════════════ */}
      <div className="relative flex items-center gap-4 md:gap-6 flex-1 z-10">
        {/* Mobile Menu Button */}
        <button className="md:hidden relative p-2.5 rounded-xl bg-gradient-to-br from-indigo-500 to-violet-500 text-white shadow-lg shadow-indigo-500/30 hover:shadow-xl hover:scale-105 active:scale-95 transition-all">
          <Menu size={20} strokeWidth={2.5} />
        </button>

        {/* Search Bar */}
        <div className="relative max-w-md w-full group">
          {/* Animated gradient glow on focus */}
          <div className={cn(
            "absolute -inset-[2px] rounded-2xl bg-gradient-to-r from-blue-400 via-indigo-500 to-violet-500 opacity-0 blur-md transition-all duration-500",
            searchFocused && "opacity-30"
          )}></div>

          {/* Rotating gradient border on focus */}
          <div className={cn(
            "absolute -inset-[1px] rounded-2xl bg-gradient-to-r from-blue-500 via-indigo-500 to-violet-500 opacity-0 transition-opacity duration-300",
            searchFocused && "opacity-100"
          )}></div>

          <div className="relative">
            {/* Search Icon */}
            <div className={cn(
              "absolute left-3 top-1/2 -translate-y-1/2 w-8 h-8 rounded-xl flex items-center justify-center transition-all duration-300",
              searchFocused
                ? "bg-gradient-to-br from-blue-500 via-indigo-500 to-violet-500 text-white shadow-lg shadow-indigo-500/40 scale-110 rotate-6"
                : "bg-gradient-to-br from-slate-100 to-slate-50 text-slate-400"
            )}>
              <Search size={15} strokeWidth={2.5} />
            </div>

            <input
              onFocus={() => setSearchFocused(true)}
              onBlur={() => setSearchFocused(false)}
              className={cn(
                "w-full border rounded-2xl py-2.5 pl-14 pr-20 transition-all text-sm outline-none font-medium",
                "bg-white/80 backdrop-blur-sm border-white/60 text-slate-700 placeholder:text-slate-400",
                "focus:bg-white focus:border-transparent",
                "shadow-sm hover:shadow-md focus:shadow-lg focus:shadow-indigo-500/10"
              )}
              placeholder="Search bookings, providers, analytics..."
              type="text"
            />

            {/* Keyboard shortcut hint */}
            <div className="absolute right-3 top-1/2 -translate-y-1/2 hidden md:flex items-center gap-1 pointer-events-none">
              <kbd className={cn(
                "flex items-center gap-0.5 px-2 py-1 text-[10px] font-bold rounded-lg border transition-all duration-300",
                searchFocused
                  ? "bg-gradient-to-br from-indigo-50 to-violet-50 text-indigo-600 border-indigo-200/60 shadow-sm"
                  : "bg-gradient-to-br from-slate-50 to-slate-100 text-slate-500 border-slate-200/60"
              )}>
                <Command size={9} strokeWidth={3} />
                <span>K</span>
              </kbd>
            </div>
          </div>
        </div>
      </div>

      {/* ═══════════════ RIGHT: Status + Theme + Profile ═══════════════ */}
      <div className="relative flex items-center gap-3 z-10">
        {/* System Status Pill */}
        <div className="hidden lg:flex items-center gap-2 bg-gradient-to-r from-emerald-50 via-green-50 to-teal-50 border border-emerald-200/50 rounded-full px-4 py-2 shadow-sm shadow-emerald-500/5 hover:shadow-md hover:shadow-emerald-500/10 transition-all">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-gradient-to-br from-emerald-400 to-green-500"></span>
          </span>
          <span className="text-[10px] font-extrabold bg-gradient-to-r from-emerald-600 to-teal-600 bg-clip-text text-transparent uppercase tracking-[0.15em]">
            System Online
          </span>
        </div>

        {/* Theme Toggle */}
        <button
          onClick={() => setIsDark(!isDark)}
          className={cn(
            "relative p-2.5 rounded-xl transition-all duration-300 group overflow-hidden",
            isDark
              ? "bg-gradient-to-br from-indigo-500 via-blue-500 to-violet-500 shadow-lg shadow-indigo-500/30"
              : "bg-gradient-to-br from-amber-400 via-orange-400 to-yellow-400 shadow-lg shadow-amber-500/30",
            "hover:scale-110 hover:rotate-6 active:scale-95",
            "hover:shadow-xl"
          )}
          title={isDark ? "Switch to light mode" : "Switch to dark mode"}
        >
          {/* Animated shine effect */}
          <div className="absolute inset-0 bg-gradient-to-tr from-transparent via-white/30 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>

          <div className="relative w-5 h-5 flex items-center justify-center">
            {isDark ? (
              <Sun size={20} className="text-white drop-shadow-sm group-hover:rotate-45 transition-transform duration-500" />
            ) : (
              <Moon size={20} className="text-white drop-shadow-sm group-hover:-rotate-12 transition-transform duration-500" />
            )}
          </div>
        </button>

        {/* Elegant Divider */}
        <div className="h-9 w-[1.5px] mx-1 bg-gradient-to-b from-transparent via-indigo-200/70 to-transparent"></div>

        {/* ═══════════════ BRAND PROFILE: UWE SERVICE ═══════════════ */}
        <div
          onMouseEnter={() => setProfileHover(true)}
          onMouseLeave={() => setProfileHover(false)}
          className="relative flex items-center gap-3 pl-1 pr-2 py-1 rounded-2xl cursor-pointer group transition-all duration-300 hover:bg-gradient-to-r hover:from-indigo-50/60 hover:via-blue-50/60 hover:to-violet-50/60"
        >
          {/* Brand Info */}
          <div className="text-right hidden sm:block">
            <div className="flex items-center gap-1.5 justify-end">
              <p className="text-sm font-extrabold bg-gradient-to-r from-blue-600 via-indigo-600 to-violet-600 bg-clip-text text-transparent tracking-tight">
                UWE SERVICE
              </p>
              <Sparkles
                size={13}
                className={cn(
                  "text-amber-400 drop-shadow-[0_0_6px_rgba(251,191,36,0.7)] transition-transform duration-500",
                  profileHover && "rotate-180 scale-125"
                )}
              />
            </div>
            <p className="text-[9px] font-extrabold uppercase tracking-[0.18em] mt-0.5 bg-gradient-to-r from-slate-500 to-slate-400 bg-clip-text text-transparent">
              Admin Dashboard
            </p>
          </div>

          {/* Avatar with layered gradient ring */}
          <div className="relative">
            {/* Outer glow ring (animated on hover) */}
            <div className={cn(
              "absolute -inset-1 rounded-2xl bg-gradient-to-br from-blue-500 via-indigo-500 to-violet-500 opacity-40 blur-md transition-all duration-500",
              profileHover && "opacity-70 scale-110"
            )}></div>

            {/* Inner gradient ring */}
            <div className="absolute -inset-[2px] rounded-xl bg-gradient-to-br from-blue-400 via-indigo-500 to-violet-500"></div>

            {/* Avatar */}
            <div className="relative w-10 h-10 rounded-xl overflow-hidden ring-2 ring-white shadow-lg">
              <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-blue-500 via-indigo-500 to-violet-600 relative overflow-hidden">
                {/* Shimmer effect */}
                <div className={cn(
                  "absolute inset-0 bg-gradient-to-tr from-transparent via-white/40 to-transparent transition-opacity duration-500",
                  profileHover ? "opacity-100" : "opacity-0"
                )}></div>

                <span className="relative text-white font-black text-lg tracking-tight drop-shadow-md">
                  U
                </span>
              </div>
            </div>

            {/* Online indicator with pulse */}
            <div className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full bg-gradient-to-br from-emerald-400 to-green-500 ring-2 ring-white shadow-md">
              <div className="absolute inset-0 rounded-full bg-emerald-400 animate-ping opacity-70"></div>
            </div>
          </div>

          {/* Chevron with gradient */}
          <ChevronDown
            size={16}
            className={cn(
              "hidden sm:block text-indigo-400 transition-all duration-300",
              profileHover && "text-violet-500 translate-y-0.5 rotate-180"
            )}
            strokeWidth={2.5}
          />
        </div>
      </div>
    </header>
  );
}