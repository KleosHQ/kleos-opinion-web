"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion, useReducedMotion } from "framer-motion";
import { Flame, Wallet, User, Shield, WalletCards } from "lucide-react";
import { cn } from "@/lib/utils";

const tabs = [
  {
    href: "/",
    label: "Markets",
    icon: (active: boolean) => (
      <Flame
        className={cn("w-6 h-6 shrink-0", active && "text-white")}
        strokeWidth={active ? 2.5 : 1.8}
        fill={active ? "currentColor" : "none"}
      />
    ),
  },
  {
    href: "/positions",
    label: "Portfolio",
    icon: (active: boolean) => (
      <WalletCards
        className={cn("w-6 h-6 shrink-0", active && "text-white ")}
        strokeWidth={active ? 2.5 : 1.8}
        fill={active ? "currentColor" : "none"}
      />
    ),
  },
  {
    href: "/profile",
    label: "Profile",
    icon: (active: boolean) => (
      <User
        className={cn("w-6 h-6 shrink-0", active && "text-white ")}
        strokeWidth={active ? 2.5 : 1.8}
        fill={active ? "currentColor" : "none"}
      />
    ),
  },
  {
    href: "/admin",
    label: "Admin",
    adminOnly: true,
    icon: (active: boolean) => (
      <Shield
        className={cn("w-6 h-6 shrink-0", active && "text-white")}
        strokeWidth={active ? 2.5 : 1.8}
        fill={active ? "currentColor" : "none"}
      />
    ),
  },
];

interface BottomBarProps {
  isAdmin?: boolean;
}

export function BottomBar({ isAdmin }: BottomBarProps) {
  const pathname = usePathname();
  const shouldReduceMotion = useReducedMotion();

  const visibleTabs = tabs.filter((t) => !t.adminOnly || isAdmin);

  return (
    <nav className="fixed bottom-4 left-0 right-0 z-50 px-4 safe-area-bottom">
      <motion.div
        className="mx-auto w-fit gap-12 relative overflow-hidden rounded-2xl bg-kleos-bg-card border border-kleos-border px-6  py-3 shadow-xl flex items-center"
        initial={false}
        transition={{ duration: 0.2 }}
      >
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
                "flex flex-col items-center justify-center transition-colors duration-200",
                isActive ? "text-white" : "text-[#737373] hover:text-[#a3a3a3]"
              )}
            >
              <motion.span
                layout
                className="flex flex-col items-center transition-colors duration-200"
                transition={
                  shouldReduceMotion
                    ? { duration: 0 }
                    : { type: "spring", stiffness: 400, damping: 35 }
                }
              >
                {tab.icon(isActive)}
                {isActive ? (
                  <motion.div
                    layoutId="nav-active-content"
                    className="flex flex-col items-center"
                    transition={
                      shouldReduceMotion
                        ? { duration: 0 }
                        : { type: "spring", stiffness: 400, damping: 35 }
                    }
                  >
                    <motion.span
                      layout
                      className="mt-1 text-[10px] font-medium whitespace-nowrap"
                      transition={
                        shouldReduceMotion
                          ? { duration: 0 }
                          : { type: "spring", stiffness: 400, damping: 30 }
                      }
                    >
                      {tab.label}
                    </motion.span>
                    <span
                      className="bottom-0 absolute w-[6vw] h-0.5 bg-white"
                    />
                  </motion.div>
                ) : null}
              </motion.span>
            </Link>
          );
        })}
      </motion.div>
    </nav>
  );
}
