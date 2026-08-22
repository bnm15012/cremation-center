import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { getDashboardStats } from "@/lib/records.functions";
import { AmcExpiryTicker } from "@/components/AmcExpiryTicker";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  FileTextIcon,
  ClipboardCheckIcon,
  ClockIcon,
  AlertCircleIcon,
} from "lucide-react";

export const Route = createFileRoute("/_app/dashboard")({
  component: DashboardPage,
});

function DashboardPage() {
  const { session } = Route.useRouteContext();
  const isAdmin = session?.role === "admin";

  const { data, isLoading } = useQuery({
    queryKey: ["dashboard-stats"],
    queryFn: () => getDashboardStats(),
  });

  const stats = data?.stats;

  const statCards = [
    {
      label: "Total Records",
      value: stats?.total ?? 0,
      icon: FileTextIcon,
      color: "text-slate-700",
      bg: "bg-slate-100",
      status: "all",
    },
    {
      label: "Pending Review",
      value: stats?.submitted ?? 0,
      icon: ClockIcon,
      color: "text-amber-600",
      bg: "bg-amber-50",
      status: "submitted",
    },
    {
      label: "Approved",
      value: stats?.approved ?? 0,
      icon: ClipboardCheckIcon,
      color: "text-green-600",
      bg: "bg-green-50",
      status: "approved",
    },
    {
      label: "Rejected",
      value: stats?.rejected ?? 0,
      icon: AlertCircleIcon,
      color: "text-red-600",
      bg: "bg-red-50",
      status: "rejected",
    },
  ];

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      <AmcExpiryTicker role={session?.role ?? "staff"} />

      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-900">
          {isAdmin ? "Admin Dashboard" : "Staff Dashboard"}
        </h1>
        <p className="text-slate-500 mt-1">
          Welcome back, {session?.fullName}.
          {isAdmin
            ? " Manage and review all records."
            : " Create and manage your records."}
        </p>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {statCards.map((card) => (
          <Link
            key={card.label}
            to="/records"
            search={{ status: card.status }}
            className="block group"
          >
            <Card className="border border-slate-200 shadow-sm transition-all group-hover:border-slate-300 group-hover:shadow-md group-hover:-translate-y-0.5">
              <CardContent className="pt-5 pb-4">
                <div className={`w-9 h-9 ${card.bg} rounded-lg flex items-center justify-center mb-3`}>
                  <card.icon className={`w-5 h-5 ${card.color}`} />
                </div>
                {isLoading ? (
                  <Skeleton className="h-7 w-12 mb-1" />
                ) : (
                  <p className="text-2xl font-bold text-slate-900">{card.value}</p>
                )}
                <p className="text-xs text-slate-500">{card.label}</p>
                <p className="text-xs text-slate-400 mt-1 opacity-0 group-hover:opacity-100 transition-opacity">View →</p>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>

      {/* Quick actions */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card className="border border-slate-200 shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Quick Actions</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <Link
              to="/records/new"
              className="flex items-center gap-3 p-3 rounded-lg bg-slate-50 hover:bg-slate-100 transition-colors"
            >
              <div className="w-8 h-8 bg-slate-800 rounded-lg flex items-center justify-center">
                <FileTextIcon className="w-4 h-4 text-white" />
              </div>
              <div>
                <p className="text-sm font-medium text-slate-900">New Cremation Record</p>
                <p className="text-xs text-slate-500">Register a new cremation case</p>
              </div>
            </Link>

            <Link
              to="/records"
              className="flex items-center gap-3 p-3 rounded-lg bg-slate-50 hover:bg-slate-100 transition-colors"
            >
              <div className="w-8 h-8 bg-slate-800 rounded-lg flex items-center justify-center">
                <ClipboardCheckIcon className="w-4 h-4 text-white" />
              </div>
              <div>
                <p className="text-sm font-medium text-slate-900">View All Records</p>
                <p className="text-xs text-slate-500">Browse and search all records</p>
              </div>
            </Link>

            {isAdmin && (
              <Link
                to="/records"
                search={{ status: "submitted" }}
                className="flex items-center gap-3 p-3 rounded-lg bg-amber-50 hover:bg-amber-100 transition-colors"
              >
                <div className="w-8 h-8 bg-amber-500 rounded-lg flex items-center justify-center">
                  <ClockIcon className="w-4 h-4 text-white" />
                </div>
                <div>
                  <p className="text-sm font-medium text-slate-900">Review Pending</p>
                  <p className="text-xs text-slate-500">
                    {stats?.submitted ?? 0} record(s) awaiting approval
                  </p>
                </div>
              </Link>
            )}
          </CardContent>
        </Card>

        <Card className="border border-slate-200 shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Status Overview</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-2">
                {[1, 2, 3].map((i) => (
                  <Skeleton key={i} className="h-8 w-full" />
                ))}
              </div>
            ) : (
              <div className="space-y-3">
                {[
                  { label: "Submitted", value: stats?.submitted ?? 0, color: "bg-amber-400" },
                  { label: "Approved", value: stats?.approved ?? 0, color: "bg-green-500" },
                  { label: "Rejected", value: stats?.rejected ?? 0, color: "bg-red-500" },
                ].map(({ label, value, color }) => (
                  <div key={label} className="flex items-center gap-3">
                    <span className="text-sm text-slate-600 w-20">{label}</span>
                    <div className="flex-1 bg-slate-100 rounded-full h-2">
                      <div
                        className={`${color} h-2 rounded-full transition-all`}
                        style={{
                          width:
                            stats?.total
                              ? `${Math.round((value / stats.total) * 100)}%`
                              : "0%",
                        }}
                      />
                    </div>
                    <span className="text-sm font-medium text-slate-900 w-6 text-right">
                      {value}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
