import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { listRecords } from "@/lib/records.functions";
import { getAmcStatus } from "@/lib/amc.functions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import {
  PlusCircleIcon,
  SearchIcon,
  ChevronRightIcon,
  FileTextIcon,
  CalendarIcon,
  UserIcon,
} from "lucide-react";
import { useState } from "react";
import { format } from "date-fns";
import { z } from "zod";

const searchSchema = z.object({
  status: z.string().optional(),
});

export const Route = createFileRoute("/_app/records/")({
  validateSearch: searchSchema,
  component: RecordsPage,
});

const statusColors: Record<string, string> = {
  draft: "bg-gray-100 text-gray-700 border-gray-200",
  submitted: "bg-amber-50 text-amber-700 border-amber-200",
  approved: "bg-green-50 text-green-700 border-green-200",
  rejected: "bg-red-50 text-red-700 border-red-200",
};

function RecordsPage() {
  const { status: initialStatus } = Route.useSearch();
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState(initialStatus ?? "all");

  const { data, isLoading } = useQuery({
    queryKey: ["records", search, status],
    queryFn: () => listRecords({ data: { search, status } }),
  });

  const { data: amc } = useQuery({
    queryKey: ["amc-status"],
    queryFn: () => getAmcStatus(),
    refetchInterval: 60_000,
  });

  const records = data?.records ?? [];
  const isAdmin = data?.isAdmin ?? false;
  const amcActive = amc?.active ?? true;

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Records</h1>
          <p className="text-slate-500 mt-0.5 text-sm">
            {isAdmin ? "All records across the centre" : "Your submitted records"}
          </p>
        </div>
        {amcActive ? (
          <Link to="/records/new">
            <Button className="gap-2">
              <PlusCircleIcon className="w-4 h-4" />
              New Record
            </Button>
          </Link>
        ) : (
          <Button className="gap-2" disabled title="AMC plan expired. Renew to create records.">
            <PlusCircleIcon className="w-4 h-4" />
            New Record
          </Button>
        )}
      </div>

      {/* Filters */}
      <div className="flex gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <Input
            placeholder="Search by name, certificate no…"
            className="pl-9"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger className="w-44">
            <SelectValue placeholder="All statuses" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            <SelectItem value="draft">Draft</SelectItem>
            <SelectItem value="submitted">Submitted</SelectItem>
            <SelectItem value="approved">Approved</SelectItem>
            <SelectItem value="rejected">Rejected</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* List */}
      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3, 4, 5].map((i) => (
            <Skeleton key={i} className="h-20 w-full rounded-xl" />
          ))}
        </div>
      ) : records.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="w-14 h-14 bg-slate-100 rounded-full flex items-center justify-center mb-4">
            <FileTextIcon className="w-7 h-7 text-slate-400" />
          </div>
          <p className="text-slate-600 font-medium">No records found</p>
          <p className="text-slate-400 text-sm mt-1">
            {search || status !== "all"
              ? "Try adjusting your filters"
              : amcActive
                ? "Create the first record"
                : "AMC plan expired. Renew to create records."}
          </p>
          {amcActive && (
            <Link to="/records/new" className="mt-4">
              <Button variant="outline" size="sm" className="gap-2">
                <PlusCircleIcon className="w-4 h-4" />
                New Record
              </Button>
            </Link>
          )}
        </div>
      ) : (
        <div className="space-y-2">
          {records.map((record) => (
            <Link
              key={record.id}
              to="/records/$id"
              params={{ id: String(record.id) }}
              className="block"
            >
              <div className="bg-white border border-slate-200 rounded-xl p-4 hover:border-slate-300 hover:shadow-sm transition-all flex items-center gap-4">
                <div className="w-10 h-10 bg-slate-100 rounded-lg flex items-center justify-center shrink-0">
                  <FileTextIcon className="w-5 h-5 text-slate-500" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-semibold text-slate-900 truncate">
                      {record.deceased_name}
                    </p>
                    <Badge
                      className={`text-xs capitalize border ${statusColors[record.status] ?? ""}`}
                      variant="outline"
                    >
                      {record.status}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-4 mt-1 text-xs text-slate-500 flex-wrap">
                    <span className="flex items-center gap-1">
                      <CalendarIcon className="w-3.5 h-3.5" />
                      Died{" "}
                      {record.date_of_death
                        ? format(new Date(record.date_of_death), "dd MMM yyyy")
                        : "—"}
                      {record.time_of_death ? ` at ${record.time_of_death}` : ""}
                    </span>
                    {record.next_of_kin_name && (
                      <span className="flex items-center gap-1">
                        <UserIcon className="w-3.5 h-3.5" />
                        {record.next_of_kin_name}
                      </span>
                    )}
                    {isAdmin && record.created_by_name && (
                      <span className="text-slate-400">by {record.created_by_name}</span>
                    )}
                  </div>
                </div>
                <ChevronRightIcon className="w-4 h-4 text-slate-400 shrink-0" />
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
