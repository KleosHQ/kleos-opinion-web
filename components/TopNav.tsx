"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { Flame, WalletCards, User, Shield } from "lucide-react";
import { cn } from "@/lib/utils";

const tabs = [
  {
    href: "/",
    label: "Markets",
    icon: Flame,
  },
  {
    href: "/positions",
    label: "Portfolio",
    icon: WalletCards,
  },
  {
    href: "/profile",
    label: "Profile",
    icon: User,
  },
  {
    href: "/admin",
    label: "Admin",
    icon: Shield,
    adminOnly: true,
  },
];

interface TopNavProps {
  isAdmin?: boolean;
}

export function TopNav({ isAdmin }: TopNavProps) {
  const pathname = usePathname();
  const visibleTabs = tabs.filter((t) => !t.adminOnly || isAdmin);

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 border-b border-kleos-border bg-kleos-bg/95 backdrop-blur-sm">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <Link href="/" className="flex items-center gap-3 shrink-0">
            <div className="w-8 h-8 relative">
              <Image
                src="/logo/kleos.jpg"
                alt="Kleos"
                fill
                className="object-contain rounded"
              />
            </div>
            <span className="text-white font-secondary font-bold text-lg hidden sm:inline">
              Kleos
            </span>
          </Link>

          <div className="flex items-center gap-1">
            {visibleTabs.map((tab) => {
              const isActive =
                tab.href === "/"
                  ? pathname === "/"
                  : pathname.startsWith(tab.href);
              const Icon = tab.icon;

              return (
                <Link
                  key={tab.href}
                  href={tab.href}
                  className={cn(
                    "flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors",
                    isActive
                      ? "bg-white/10 text-white"
                      : "text-kleos-text-muted hover:text-white hover:bg-white/5"
                  )}
                >
                  <Icon className="w-4 h-4 shrink-0" strokeWidth={isActive ? 2.5 : 1.8} />
                  {tab.label}
                </Link>
              );
            })}
          </div>
        </div>
      </div>
    </nav>
  );
}
