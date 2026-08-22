import {
  createFileRoute,
  redirect,
  Outlet,
  Link,
  useRouter,
  useRouterState,
} from "@tanstack/react-router";
import { getSession, logout } from "@/lib/auth";
import { AmcBanner } from "@/components/AmcBanner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuSeparator,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  FlameIcon,
  LayoutDashboardIcon,
  FileTextIcon,
  UsersIcon,
  LogOutIcon,
  MenuIcon,
  XIcon,
  UserCircleIcon,
  ShieldIcon,
  MailIcon,
  KeyRoundIcon,
} from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_app")({
  beforeLoad: async () => {
    const session = await getSession();
    if (!session) {
      throw redirect({ to: "/login" });
    }
    return { session };
  },
  component: AppLayout,
});

function AppLayout() {
  const router = useRouter();
  const { session } = Route.useRouteContext();
  const [mobileOpen, setMobileOpen] = useState(false);
  const isAdmin = session?.role === "admin";

  const handleLogout = async () => {
    await logout();
    await router.invalidate();
    router.navigate({ to: "/login" });
  };

  const navItems = [
    { to: "/dashboard", label: "Dashboard", icon: LayoutDashboardIcon },
    { to: "/records", label: "Records", icon: FileTextIcon },
    ...(isAdmin ? [{ to: "/admin/users", label: "Manage Users", icon: UsersIcon }] : []),
  ];

  const Sidebar = ({ onClose }: { onClose?: () => void }) => (
    <>
      <div className="flex items-center gap-3 px-6 py-5 border-b border-slate-700">
        <div className="w-8 h-8 bg-orange-500 rounded-lg flex items-center justify-center shrink-0">
          <FlameIcon className="w-5 h-5 text-white" />
        </div>
        <div>
          <p className="text-sm font-bold leading-none">Cremation Center</p>
          <p className="text-xs text-slate-400 mt-0.5">Records</p>
        </div>
        {onClose && (
          <Button
            variant="ghost"
            size="icon"
            className="ml-auto text-slate-400"
            onClick={onClose}
          >
            <XIcon className="w-5 h-5" />
          </Button>
        )}
      </div>

      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        {navItems.map((item) => (
          <SidebarLink key={item.to} {...item} onClick={onClose} />
        ))}
      </nav>
    </>
  );

  // Avatar initials
  const initials = session?.fullName
    ?.split(" ")
    .map((w) => w[0])
    .slice(0, 2)
    .join("")
    .toUpperCase() ?? "U";

  return (
    <div className="flex h-screen bg-slate-50 overflow-hidden">
      {/* Desktop sidebar */}
      <aside className="hidden md:flex md:flex-col w-64 bg-slate-900 text-white shrink-0">
        <Sidebar />
      </aside>

      {/* Mobile sidebar overlay */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 md:hidden">
          <div
            className="absolute inset-0 bg-black/60"
            onClick={() => setMobileOpen(false)}
          />
          <aside className="absolute left-0 top-0 bottom-0 w-72 bg-slate-900 text-white flex flex-col">
            <Sidebar onClose={() => setMobileOpen(false)} />
          </aside>
        </div>
      )}

      {/* Main content area */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">

        {/* AMC renewal banner */}
        <AmcBanner role={isAdmin ? "admin" : "staff"} />

        {/* Top header bar — always visible */}
        <header className="flex items-center justify-between px-5 py-3 bg-white border-b border-slate-200 shadow-sm shrink-0">
          {/* Left: hamburger (mobile) */}
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="icon"
              className="md:hidden"
              onClick={() => setMobileOpen(true)}
            >
              <MenuIcon className="w-5 h-5" />
            </Button>
            {/* Mobile brand */}
            <div className="flex items-center gap-2 md:hidden">
              <FlameIcon className="w-5 h-5 text-orange-500" />
              <span className="font-semibold text-slate-900 text-sm">Cremation Center</span>
            </div>
          </div>

          {/* Right: profile dropdown */}
          <div className="ml-auto">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="flex items-center gap-2.5 rounded-xl px-3 py-1.5 hover:bg-slate-100 transition-colors focus:outline-none">
                  <div className={cn(
                    "w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold text-white shrink-0",
                    isAdmin ? "bg-orange-500" : "bg-slate-600"
                  )}>
                    {initials}
                  </div>
                  <div className="hidden sm:block text-left">
                    <p className="text-sm font-medium text-slate-900 leading-none">{session?.fullName}</p>
                    <p className="text-xs text-slate-500 mt-0.5 capitalize">{session?.role}</p>
                  </div>
                </button>
              </DropdownMenuTrigger>

              <DropdownMenuContent align="end" className="w-64">
                {/* Profile card at top */}
                <div className="px-3 py-3 border-b border-slate-100">
                  <div className="flex items-center gap-3">
                    <div className={cn(
                      "w-11 h-11 rounded-full flex items-center justify-center text-base font-bold text-white shrink-0",
                      isAdmin ? "bg-orange-500" : "bg-slate-600"
                    )}>
                      {initials}
                    </div>
                    <div className="min-w-0">
                      <p className="font-semibold text-slate-900 text-sm truncate">{session?.fullName}</p>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <MailIcon className="w-3 h-3 text-slate-400 shrink-0" />
                        <p className="text-xs text-slate-500 truncate">{session?.email}</p>
                      </div>
                      <div className="flex items-center gap-1.5 mt-1">
                        {isAdmin
                          ? <ShieldIcon className="w-3 h-3 text-orange-500 shrink-0" />
                          : <UserCircleIcon className="w-3 h-3 text-slate-400 shrink-0" />
                        }
                        <Badge
                          variant="outline"
                          className={cn(
                            "text-xs capitalize px-1.5 py-0 h-4 border",
                            isAdmin
                              ? "bg-orange-50 border-orange-200 text-orange-700"
                              : "bg-slate-50 border-slate-200 text-slate-600"
                          )}
                        >
                          {session?.role}
                        </Badge>
                      </div>
                    </div>
                  </div>
                </div>

                <DropdownMenuSeparator />

                <DropdownMenuItem asChild className="gap-2 cursor-pointer">
                  <Link to="/change-password">
                    <KeyRoundIcon className="w-4 h-4 text-slate-500" />
                    Change Password
                  </Link>
                </DropdownMenuItem>

                <DropdownMenuSeparator />

                <DropdownMenuItem
                  className="gap-2 text-red-600 focus:text-red-600 focus:bg-red-50 cursor-pointer"
                  onClick={handleLogout}
                >
                  <LogOutIcon className="w-4 h-4" />
                  Sign out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

function SidebarLink({
  to,
  label,
  icon: Icon,
  onClick,
}: {
  to: string;
  label: string;
  icon: React.ElementType;
  onClick?: () => void;
}) {
  const { location } = useRouterState();
  const isActive =
    to === "/dashboard"
      ? location.pathname === "/dashboard"
      : location.pathname.startsWith(to);

  return (
    <Link
      to={to}
      onClick={onClick}
      className={cn(
        "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors",
        isActive
          ? "bg-slate-700 text-white"
          : "text-slate-400 hover:text-white hover:bg-slate-800"
      )}
    >
      <Icon className="w-4 h-4 shrink-0" />
      {label}
    </Link>
  );
}
