import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { requestPasswordReset } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { KeyRoundIcon, ArrowLeftIcon, CheckCircleIcon, Loader2Icon } from "lucide-react";

export const Route = createFileRoute("/forgot-password")({
  component: ForgotPasswordPage,
});

function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) {
      toast.error("Please enter your email");
      return;
    }
    setLoading(true);
    try {
      await requestPasswordReset({ data: { email } });
      setSent(true);
      toast.success("If an account exists, a reset code has been sent");
    } catch (err: any) {
      toast.error(err.message ?? "Failed to send reset code");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-slate-50">
      <div className="w-full max-w-md space-y-6">
        <div className="flex flex-col items-center">
          <div className="w-16 h-16 bg-slate-800 rounded-2xl flex items-center justify-center mb-4 shadow-lg">
            <KeyRoundIcon className="w-8 h-8 text-orange-400" />
          </div>
          <h1 className="text-2xl font-bold text-slate-900">Cremation System</h1>
          <p className="text-sm text-slate-500 mt-1">Record Management System</p>
        </div>

        <Card className="border border-slate-200 shadow-md">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Forgot your password?</CardTitle>
            <CardDescription>
              Enter your email and we'll send you a 6-digit code to reset it.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {sent ? (
              <div className="text-center space-y-4">
                <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mx-auto">
                  <CheckCircleIcon className="w-6 h-6 text-green-500" />
                </div>
                <p className="text-sm text-slate-600">
                  If <strong>{email}</strong> is registered, a reset code has been sent.
                </p>
                <Button asChild className="w-full">
                  <Link to="/reset-password" search={{ email }}>
                    Continue to Reset
                  </Link>
                </Button>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="you@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                  />
                </div>
                <Button type="submit" disabled={loading} className="w-full">
                  {loading ? (
                    <Loader2Icon className="w-4 h-4 animate-spin mr-2" />
                  ) : null}
                  Send Reset Code
                </Button>
              </form>
            )}
          </CardContent>
        </Card>

        <div className="text-center">
          <Link to="/login" className="inline-flex items-center text-sm text-slate-500 hover:text-slate-800">
            <ArrowLeftIcon className="w-4 h-4 mr-1" />
            Back to sign in
          </Link>
        </div>
      </div>
    </div>
  );
}
