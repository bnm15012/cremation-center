import { createFileRoute, redirect, useRouter } from "@tanstack/react-router";
import { useState } from "react";
import { z } from "zod";
import { getInviteByToken, acceptInvite } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { FlameIcon, CheckCircleIcon, AlertCircleIcon } from "lucide-react";

const searchSchema = z.object({
  token: z.string().catch(""),
});

export const Route = createFileRoute("/accept-invite")({
  validateSearch: searchSchema,
  beforeLoad: async ({ search }) => {
    if (!search.token) {
      throw redirect({ to: "/login" });
    }
    const invite = await getInviteByToken({ data: { token: search.token } });
    return { invite };
  },
  component: AcceptInvitePage,
});

function AcceptInvitePage() {
  const { token } = Route.useSearch();
  const { invite } = Route.useRouteContext();
  const router = useRouter();

  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  // Invalid / expired token
  if (!invite) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center p-4">
        <Card className="w-full max-w-md shadow-md border-0 text-center">
          <CardContent className="pt-10 pb-8 space-y-4">
            <div className="w-14 h-14 bg-red-100 rounded-full flex items-center justify-center mx-auto">
              <AlertCircleIcon className="w-7 h-7 text-red-500" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-slate-900">Invalid or expired link</h2>
              <p className="text-sm text-slate-500 mt-1">
                This invite link is no longer valid. Please ask your admin to send a new invite.
              </p>
            </div>
            <Button variant="outline" onClick={() => router.navigate({ to: "/login" })}>
              Back to login
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Success state
  if (done) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center p-4">
        <Card className="w-full max-w-md shadow-md border-0 text-center">
          <CardContent className="pt-10 pb-8 space-y-4">
            <div className="w-14 h-14 bg-green-100 rounded-full flex items-center justify-center mx-auto">
              <CheckCircleIcon className="w-7 h-7 text-green-500" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-slate-900">Account activated!</h2>
              <p className="text-sm text-slate-500 mt-1">
                Redirecting you to the dashboard…
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 8) {
      toast.error("Password must be at least 8 characters");
      return;
    }
    if (password !== confirm) {
      toast.error("Passwords do not match");
      return;
    }
    setLoading(true);
    try {
      await acceptInvite({ data: { token, password } });
      setDone(true);
      setTimeout(async () => {
        await router.invalidate();
        router.navigate({ to: "/dashboard" });
      }, 1500);
    } catch (err: any) {
      toast.error(err.message ?? "Failed to activate account");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Branding */}
        <div className="flex flex-col items-center mb-8">
          <div className="w-16 h-16 bg-slate-800 rounded-2xl flex items-center justify-center mb-4 shadow-lg">
            <FlameIcon className="w-9 h-9 text-orange-400" />
          </div>
          <h1 className="text-2xl font-bold text-slate-900">Cremation Center</h1>
          <p className="text-sm text-slate-500 mt-1">Record Management System</p>
        </div>

        <Card className="shadow-md border-0">
          <CardHeader className="pb-3">
            <CardTitle className="text-xl">Activate your account</CardTitle>
            <CardDescription>
              Welcome, <strong>{invite.fullName}</strong>! You've been invited as{" "}
              <Badge
                variant="outline"
                className={
                  invite.role === "admin"
                    ? "border-orange-200 bg-orange-50 text-orange-700 capitalize text-xs"
                    : "border-slate-200 bg-slate-50 text-slate-700 capitalize text-xs"
                }
              >
                {invite.role}
              </Badge>
              . Set a password to get started.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <Label>Email</Label>
                <Input value={invite.email} disabled className="bg-slate-50 text-slate-500" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="password">New Password</Label>
                <Input
                  id="password"
                  type="password"
                  placeholder="Min. 8 characters"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  autoFocus
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="confirm">Confirm Password</Label>
                <Input
                  id="confirm"
                  type="password"
                  placeholder="Re-enter your password"
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  required
                />
              </div>
              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? "Activating…" : "Activate Account"}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
