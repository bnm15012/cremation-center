import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useState } from "react";
import { changePassword } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { KeyRoundIcon, EyeIcon, EyeOffIcon, CheckCircleIcon } from "lucide-react";
import { Link } from "@tanstack/react-router";

export const Route = createFileRoute("/_app/change-password")({
  component: ChangePasswordPage,
});

function ChangePasswordPage() {
  const router = useRouter();
  const [form, setForm] = useState({
    newPassword: "",
    confirmPassword: "",
  });
  const [show, setShow] = useState({
    new: false,
    confirm: false,
  });
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (form.newPassword !== form.confirmPassword) {
      toast.error("New passwords do not match");
      return;
    }
    setLoading(true);
    try {
      await changePassword({
        data: { newPassword: form.newPassword },
      });
      setSuccess(true);
      toast.success("Password changed successfully");
      setTimeout(() => router.navigate({ to: "/dashboard" }), 2000);
    } catch (err: any) {
      toast.error(err.message ?? "Failed to change password");
    } finally {
      setLoading(false);
    }
  };

  // Strength indicator
  const strength = (() => {
    const p = form.newPassword;
    if (!p) return 0;
    let score = 0;
    if (p.length >= 8) score++;
    if (p.length >= 12) score++;
    if (/[A-Z]/.test(p)) score++;
    if (/[0-9]/.test(p)) score++;
    if (/[^A-Za-z0-9]/.test(p)) score++;
    return score;
  })();

  const strengthLabel = ["", "Weak", "Fair", "Good", "Strong", "Very strong"][strength];
  const strengthColor = ["", "bg-red-400", "bg-orange-400", "bg-yellow-400", "bg-green-400", "bg-green-500"][strength];

  if (success) {
    return (
      <div className="p-6 max-w-lg mx-auto flex flex-col items-center justify-center min-h-[60vh]">
        <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mb-4">
          <CheckCircleIcon className="w-8 h-8 text-green-500" />
        </div>
        <h2 className="text-xl font-bold text-slate-900">Password changed!</h2>
        <p className="text-slate-500 text-sm mt-1">Redirecting to dashboard…</p>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-lg mx-auto space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Change Password</h1>
        <p className="text-slate-500 text-sm mt-0.5">Set a new password for your account</p>
      </div>

      <Card className="border border-slate-200 shadow-sm">
        <CardHeader className="pb-3 flex flex-row items-start gap-3">
          <div className="w-10 h-10 bg-slate-100 rounded-lg flex items-center justify-center shrink-0">
            <KeyRoundIcon className="w-5 h-5 text-slate-600" />
          </div>
          <div className="space-y-1">
            <CardTitle className="text-base">Set a new password</CardTitle>
            <CardDescription>
              Choose a strong new password. Minimum 8 characters.
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* New password */}
            <div className="space-y-1.5">
              <Label htmlFor="new">New Password</Label>
              <div className="relative">
                <Input
                  id="new"
                  type={show.new ? "text" : "password"}
                  placeholder="Min. 8 characters"
                  value={form.newPassword}
                  onChange={(e) => setForm((f) => ({ ...f, newPassword: e.target.value }))}
                  required
                  className="pr-10"
                />
                <button
                  type="button"
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                  onClick={() => setShow((s) => ({ ...s, new: !s.new }))}
                >
                  {show.new ? <EyeOffIcon className="w-4 h-4" /> : <EyeIcon className="w-4 h-4" />}
                </button>
              </div>
              {/* Strength bar */}
              {form.newPassword && (
                <div className="space-y-1">
                  <div className="flex gap-1">
                    {[1, 2, 3, 4, 5].map((i) => (
                      <div
                        key={i}
                        className={`h-1 flex-1 rounded-full transition-all ${
                          i <= strength ? strengthColor : "bg-slate-200"
                        }`}
                      />
                    ))}
                  </div>
                  <p className="text-xs text-slate-500">{strengthLabel}</p>
                </div>
              )}
            </div>

            {/* Confirm password */}
            <div className="space-y-1.5">
              <Label htmlFor="confirm">Confirm New Password</Label>
              <div className="relative">
                <Input
                  id="confirm"
                  type={show.confirm ? "text" : "password"}
                  placeholder="Re-enter new password"
                  value={form.confirmPassword}
                  onChange={(e) => setForm((f) => ({ ...f, confirmPassword: e.target.value }))}
                  required
                  className={`pr-10 ${
                    form.confirmPassword && form.confirmPassword !== form.newPassword
                      ? "border-red-300 focus-visible:ring-red-300"
                      : ""
                  }`}
                />
                <button
                  type="button"
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                  onClick={() => setShow((s) => ({ ...s, confirm: !s.confirm }))}
                >
                  {show.confirm ? <EyeOffIcon className="w-4 h-4" /> : <EyeIcon className="w-4 h-4" />}
                </button>
              </div>
              {form.confirmPassword && form.confirmPassword !== form.newPassword && (
                <p className="text-xs text-red-500">Passwords do not match</p>
              )}
            </div>

            <div className="pt-1 flex gap-3">
              <Button type="submit" disabled={loading} className="flex-1">
                {loading ? "Updating…" : "Update Password"}
              </Button>
              <Link to="/dashboard">
                <Button type="button" variant="outline">
                  Cancel
                </Button>
              </Link>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
