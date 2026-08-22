import { createFileRoute, redirect } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { listUsers, toggleUserActive } from "@/lib/records.functions";
import { inviteUser } from "@/lib/auth";
import { getAmcStatus } from "@/lib/amc.functions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { PlusIcon, ShieldIcon, UserIcon } from "lucide-react";
import { useState } from "react";
import { formatIST } from "@/lib/date-utils";

export const Route = createFileRoute("/_app/admin/users")({
  beforeLoad: async ({ context }) => {
    if (context.session?.role !== "admin") {
      throw redirect({ to: "/dashboard" });
    }
    return { session: context.session };
  },
  component: ManageUsersPage,
});

function ManageUsersPage() {
  const qc = useQueryClient();
  const { session } = Route.useRouteContext();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState({ email: "", fullName: "", role: "staff" as "admin" | "staff" });
  const [creating, setCreating] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["users"],
    queryFn: () => listUsers(),
  });

  const { data: amc } = useQuery({
    queryKey: ["amc-status"],
    queryFn: () => getAmcStatus(),
    refetchInterval: 60_000,
  });
  const amcActive = amc?.active ?? true;

  const toggleMut = useMutation({
    mutationFn: (args: { userId: number; isActive: boolean }) =>
      toggleUserActive({ data: args }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["users"] });
      toast.success("User updated");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const handleInviteUser = async () => {
    if (!amcActive) {
      toast.error("AMC plan expired. Please renew to add users.");
      return;
    }
    if (!form.email || !form.fullName) {
      toast.error("Name and email are required");
      return;
    }
    setCreating(true);
    try {
      await inviteUser({
        data: {
          email: form.email,
          fullName: form.fullName,
          role: form.role,
          invitedByUserId: session!.userId,
        },
      });
      toast.success(`Invite sent to ${form.email}`);
      setDialogOpen(false);
      setForm({ email: "", fullName: "", role: "staff" });
      qc.invalidateQueries({ queryKey: ["users"] });
    } catch (err: any) {
      toast.error(err.message ?? "Failed to send invite");
    } finally {
      setCreating(false);
    }
  };

  const users = data?.users ?? [];

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Manage Users</h1>
          <p className="text-slate-500 text-sm mt-0.5">Admin and staff accounts</p>
        </div>
        <Button
          onClick={() => setDialogOpen(true)}
          disabled={!amcActive}
          title={amcActive ? undefined : "AMC plan expired. Renew to add users."}
          className="gap-2"
        >
          <PlusIcon className="w-4 h-4" />
          Add User
        </Button>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-16 w-full rounded-xl" />
          ))}
        </div>
      ) : (
        <div className="space-y-2">
          {users.map((user) => (
            <div
              key={user.id}
              className="bg-white border border-slate-200 rounded-xl p-4 flex items-center gap-4"
            >
              <div className="w-10 h-10 bg-slate-100 rounded-full flex items-center justify-center shrink-0">
                {user.role === "admin" ? (
                  <ShieldIcon className="w-5 h-5 text-orange-500" />
                ) : (
                  <UserIcon className="w-5 h-5 text-slate-500" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="font-medium text-slate-900">{user.full_name}</p>
                  <Badge
                    variant="outline"
                    className={
                      user.role === "admin"
                        ? "border-orange-200 bg-orange-50 text-orange-700 text-xs capitalize"
                        : "border-slate-200 bg-slate-50 text-slate-700 text-xs capitalize"
                    }
                  >
                    {user.role}
                  </Badge>
                  {!user.is_active && (
                    <Badge variant="outline" className="border-red-200 bg-red-50 text-red-700 text-xs">
                      Disabled
                    </Badge>
                  )}
                </div>
                <p className="text-xs text-slate-500 mt-0.5">
                  {user.email} · Joined {formatIST(user.created_at, "dd MMM yyyy")}
                </p>
              </div>
              <Button
                variant="outline"
                size="sm"
                className={
                  user.is_active
                    ? "border-red-200 text-red-600 hover:bg-red-50"
                    : "border-green-200 text-green-600 hover:bg-green-50"
                }
                onClick={() => toggleMut.mutate({ userId: user.id, isActive: !user.is_active })}
                disabled={toggleMut.isPending}
              >
                {user.is_active ? "Disable" : "Enable"}
              </Button>
            </div>
          ))}
        </div>
      )}

      {/* Create user dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Invite New User</DialogTitle>
            <DialogDescription>
              An email with a secure activation link will be sent to the user.
              They will set their own password when they accept the invite.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label>Full Name</Label>
              <Input
                value={form.fullName}
                onChange={(e) => setForm((f) => ({ ...f, fullName: e.target.value }))}
                placeholder="John Smith"
                autoFocus
              />
            </div>
            <div className="space-y-1.5">
              <Label>Email</Label>
              <Input
                type="email"
                value={form.email}
                onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                placeholder="user@example.com"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Role</Label>
              <Select
                value={form.role}
                onValueChange={(v) => setForm((f) => ({ ...f, role: v as "admin" | "staff" }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="staff">Staff</SelectItem>
                  <SelectItem value="admin">Admin</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleInviteUser}
              disabled={creating || !amcActive}
              className="gap-2"
            >
              {creating ? "Sending…" : amcActive ? "Send Invite" : "AMC Expired"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
