"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { usePathname } from "next/navigation";
import { User, Crown, LogOut, ShoppingBag, LayoutDashboard, Settings, Loader2 } from "lucide-react";
import { authClient } from "@/lib/auth/client";
import { checkAdminStatus } from "@/lib/auth/admin";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { UserAvatar } from "@/components/user/user-avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { HeaderDictionary, Locale } from "@/i18n/types";

interface UserMenuProps {
  dictionary: HeaderDictionary;
  locale: Locale;
  triggerId?: string;
}

export function UserMenu({ dictionary, locale, triggerId }: UserMenuProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [userIsAdmin, setUserIsAdmin] = useState(false);
  const [membershipLoading, setMembershipLoading] = useState(false);
  const [membershipStatus, setMembershipStatus] = useState<{
    isPaid: boolean;
    period: "monthly" | "yearly" | null;
  } | null>(null);
  const router = useRouter();
  const pathname = usePathname();
  const session = authClient.useSession();
  
  const user = session.data?.user;
  const isSessionPending = session.isPending;
  const isAuthenticated = Boolean(user);

  // 检查管理员状态
  useEffect(() => {
    if (user?.email) {
      checkAdminStatus(user.email).then(setUserIsAdmin);
    }
  }, [user?.email]);

  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();

    async function loadMembership() {
      try {
        setMembershipLoading(true);
        const resp = await fetch("/api/membership/status", { cache: "no-store", signal: controller.signal });
        const json = (await resp.json().catch(() => null)) as
          | { ok: boolean; data?: { isPaid?: boolean; period?: "monthly" | "yearly" | null; reason?: string } }
          | null;

        if (cancelled) return;
        if (!json?.ok) {
          setMembershipStatus(null);
          return;
        }

        const reason = json.data?.reason;
        if (reason === "unauth" || reason === "db_disabled" || reason === "orders_table_missing" || reason === "error") {
          setMembershipStatus(null);
          return;
        }

        setMembershipStatus({
          isPaid: Boolean(json.data?.isPaid),
          period: json.data?.period ?? null,
        });
      } catch {
        if (!cancelled) setMembershipStatus(null);
      } finally {
        if (!cancelled) setMembershipLoading(false);
      }
    }

    if (isSessionPending) {
      setMembershipLoading(false);
      return () => {
        cancelled = true;
      };
    }

    if (isAuthenticated) {
      loadMembership();
    } else {
      setMembershipLoading(false);
      Promise.resolve().then(() => setMembershipStatus(null));
    }

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [isAuthenticated, isSessionPending, pathname]);

  if (!isAuthenticated) {
    return null;
  }

  const handleSignOut = async () => {
    try {
      await authClient.signOut();
      router.push("/");
    } catch (error) {
      console.error("[Better Auth] Sign out failed", error);
    }
  };

  // 获取用户头像或生成默认头像
  const getUserAvatar = () => {
    return (
      <UserAvatar
        src={user?.image}
        name={user?.name}
        email={user?.email}
        size={32}
        className="h-8 w-8"
      />
    );
  };

  const planBadge = (() => {
    if (isSessionPending || membershipLoading) {
      return {
        title: "Loading membership",
        colorClass: "text-neutral-400 dark:text-neutral-500",
        svg: <Loader2 className="h-3.5 w-3.5 animate-spin" aria-label="Loading membership" />,
      };
    }

    const isPaid = membershipStatus?.isPaid === true;
    const period = membershipStatus?.period ?? null;

    if (!isPaid) {
      return {
        title: "Free plan",
        colorClass: "text-green-600 dark:text-green-400",
        svg: (
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="h-3.5 w-3.5"
            aria-hidden="true"
            focusable="false"
          >
            <path d="M11 20A7 7 0 0 1 9.8 6.1C15.5 5 17 4.48 19 2c1 2 2 4.18 2 8 0 5.5-4.78 10-10 10Z" />
            <path d="M2 21c0-3 1.85-5.36 5.08-6C9.5 14.52 12 13 13 12" />
          </svg>
        ),
      };
    }

    const isMonthly = period === "monthly";
    const isYearly = period === "yearly";

    return {
      title: isMonthly ? "Monthly plan" : isYearly ? "Yearly plan" : "Paid plan",
      colorClass: isMonthly
        ? "text-cyan-500 dark:text-cyan-400"
        : isYearly
          ? "text-amber-500 dark:text-amber-400"
          : "text-blue-600 dark:text-blue-400",
      svg: (
        isYearly ? (
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="h-3.5 w-3.5"
            aria-hidden="true"
            focusable="false"
          >
            <path d="M4 20a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v1a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1z" />
            <path d="m6.7 18-1-1C4.35 15.682 3 14.09 3 12a5 5 0 0 1 4.95-5c1.584 0 2.7.455 4.05 1.818C13.35 7.455 14.466 7 16.05 7A5 5 0 0 1 21 12c0 2.082-1.359 3.673-2.7 5l-1 1" />
            <path d="M10 4h4" />
            <path d="M12 2v6.818" />
          </svg>
        ) : (
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="h-3.5 w-3.5"
            aria-hidden="true"
            focusable="false"
          >
            <path d="M11.562 3.266a.5.5 0 0 1 .876 0L15.39 8.87a1 1 0 0 0 1.516.294L21.183 5.5a.5.5 0 0 1 .798.519l-2.834 10.246a1 1 0 0 1-.956.734H5.81a1 1 0 0 1-.957-.734L2.02 6.02a.5.5 0 0 1 .798-.519l4.276 3.664a1 1 0 0 0 1.516-.294z" />
            <path d="M5 21h14" />
          </svg>
        )
      ),
    };
  })();

  return (
    <DropdownMenu open={isOpen} onOpenChange={setIsOpen}>
      <DropdownMenuTrigger asChild>
        <Button
          id={triggerId}
          variant="ghost"
          className="relative h-8 w-8 rounded-full p-0 hover:bg-neutral-100 dark:hover:bg-neutral-800"
          aria-label="用户菜单"
        >
          {getUserAvatar()}
          <span
            className={cn(
              "absolute -top-1 -right-1 inline-flex h-5 w-5 items-center justify-center rounded-full border border-neutral-200 bg-white shadow-sm dark:border-neutral-800 dark:bg-neutral-950",
              planBadge.colorClass,
            )}
            title={planBadge.title}
          >
            {planBadge.svg}
          </span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-56" align="end" forceMount>
        <DropdownMenuLabel className="font-normal">
          <div className="flex flex-col space-y-1">
            <p className="text-sm font-medium leading-none">
              {user?.name || "用户"}
            </p>
            <p className="text-xs leading-none text-muted-foreground">
              {user?.email}
            </p>
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link href={`/${locale}/dashboard`} className="cursor-pointer">
            <LayoutDashboard className="mr-2 h-4 w-4" />
            <span>{dictionary.userMenu.dashboard}</span>
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link href={`/${locale}/profile`} className="cursor-pointer">
            <User className="mr-2 h-4 w-4" />
            <span>{dictionary.userMenu.profile}</span>
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link href={`/${locale}/membership`} className="cursor-pointer">
            <Crown className="mr-2 h-4 w-4" />
            <span>{dictionary.userMenu.membership}</span>
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link href={`/${locale}/orders`} className="cursor-pointer">
            <ShoppingBag className="mr-2 h-4 w-4" />
            <span>{dictionary.userMenu.orders}</span>
          </Link>
        </DropdownMenuItem>
        {userIsAdmin && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild>
              <Link href="/admin/blogs" className="cursor-pointer">
                <Settings className="mr-2 h-4 w-4" />
                <span>{dictionary.userMenu.adminMenu}</span>
              </Link>
            </DropdownMenuItem>
          </>
        )}
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onClick={handleSignOut}
          className="cursor-pointer text-red-600 focus:text-red-600 dark:text-red-400 dark:focus:text-red-400"
        >
          <LogOut className="mr-2 h-4 w-4" />
          <span>{dictionary.userMenu.signOut}</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
