"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Flame, Wallet, User, Shield } from "lucide-react";
import { cn } from "@/lib/utils";

const tabs = [
  {
    href: "/",
    label: "Markets",
    icon: (active: boolean) => (
      <Flame
        className={cn("w-6 h-6", active && "text-white")}
        strokeWidth={active ? 2.5 : 1.8}
      />
    ),
  },
  {
    href: "/positions",
    label: "Portfolio",
    icon: (active: boolean) => (
      <Wallet
        className={cn("w-6 h-6", active && "text-white")}
        strokeWidth={active ? 2.5 : 1.8}
      />
    ),
  },
  {
    href: "/profile",
    label: "Profile",
    icon: (active: boolean) => (
      <User
        className={cn("w-6 h-6", active && "text-white")}
        strokeWidth={active ? 2.5 : 1.8}
      />
    ),
  },
  {
    href: "/admin",
    label: "Admin",
    adminOnly: true,
    icon: (active: boolean) => (
      <Shield
        className={cn("w-6 h-6", active && "text-white")}
        strokeWidth={active ? 2.5 : 1.8}
      />
    ),
  },
];

interface BottomBarProps {
  isAdmin?: boolean;
}

export function BottomBar({ isAdmin }: BottomBarProps) {
  const pathname = usePathname();

  const visibleTabs = tabs.filter((t) => !t.adminOnly || isAdmin);

  return (
    <nav className="fixed bottom-4 left-0 right-0 z-50 px-4 safe-area-bottom">
      <div className="max-w-md mx-auto rounded-3xl bg-kleos-bg-card border border-kleos-border px-2 py-2 shadow-lg flex items-center justify-around">
        {visibleTabs.map((tab) => {
          const isActive =
            tab.href === "/"
              ? pathname === "/"
              : pathname.startsWith(tab.href);

          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={cn(
                "flex flex-col items-center justify-center flex-1 py-2 transition-all duration-200",
                isActive ? "text-white" : "text-kleos-text-subtle hover:text-kleos-text-muted"
              )}
            >
              {tab.icon(isActive)}
              <span
                className={cn(
                  "mt-1 text-xs font-medium",
                  isActive ? "text-white" : "text-kleos-text-subtle"
                )}
              >
                {tab.label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
