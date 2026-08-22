import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getAmcStatus, createAmcOrder, verifyAmcPayment, pollAmcOrderStatus } from "@/lib/amc.functions";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { AlertTriangleIcon, ShieldAlertIcon, Loader2Icon } from "lucide-react";
import { toast } from "sonner";

// Razorpay checkout type (loaded from script)
declare global {
  interface Window {
    Razorpay?: any;
  }
}

type AmcBannerProps = {
  role: "admin" | "staff";
};

export function AmcBanner({ role }: AmcBannerProps) {
  const queryClient = useQueryClient();
  const [showDialog, setShowDialog] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["amc-status"],
    queryFn: () => getAmcStatus(),
    refetchInterval: 60_000,
  });

  // Load Razorpay checkout script
  useEffect(() => {
    if (window.Razorpay) return;
    const script = document.createElement("script");
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.async = true;
    document.body.appendChild(script);
    return () => {
      document.body.removeChild(script);
    };
  }, []);

  const orderMutation = useMutation({
    mutationFn: () => createAmcOrder(),
    onSuccess: (order) => openRazorpay(order),
    onError: (err: any) => toast.error(err.message ?? "Failed to create order"),
  });

  const verifyMutation = useMutation({
    mutationFn: verifyAmcPayment,
    onSuccess: () => {
      toast.success("AMC payment successful");
      queryClient.invalidateQueries({ queryKey: ["amc-status"] });
      setShowDialog(false);
    },
    onError: (err: any) => toast.error(err.message ?? "Payment verification failed"),
  });

  function openRazorpay(order: {
    orderId: string;
    keyId: string;
    amount: number;
    currency: string;
    name: string;
    description: string;
  }) {
    if (!window.Razorpay) {
      toast.error("Razorpay checkout not loaded. Please refresh.");
      return;
    }

    // Close our dialog first so Razorpay modal gets full focus
    setShowDialog(false);

    let poll: ReturnType<typeof setInterval> | undefined;
    const cleanupPoll = () => {
      if (poll) clearInterval(poll);
      poll = undefined;
    };

    const options = {
      key: order.keyId,
      amount: order.amount,
      currency: order.currency,
      name: order.name,
      description: order.description,
      order_id: order.orderId,
      handler: (response: any) => {
        cleanupPoll();
        if (!response || !response.razorpay_order_id || !response.razorpay_payment_id) {
          toast.error("Payment response incomplete. Please try again or contact support.");
          return;
        }
        verifyMutation.mutate({
          razorpay_order_id: response.razorpay_order_id,
          razorpay_payment_id: response.razorpay_payment_id,
          razorpay_signature: response.razorpay_signature,
        });
      },
      theme: { color: "#f97316" },
      modal: {
        ondismiss: () => {
          cleanupPoll();
          toast.info("Payment cancelled.");
        },
      },
    };

    const rzp = new window.Razorpay(options);

    // Small delay to let our dialog close and remove its overlay
    setTimeout(() => {
      rzp.open();

      // Poll fallback: Razorpay test mode sometimes doesn't call handler properly
      let attempts = 0;
      poll = setInterval(async () => {
        attempts++;
        if (attempts > 15) {
          cleanupPoll();
          return;
        }
        try {
          const res = await pollAmcOrderStatus({ data: { orderId: order.orderId } });
          if (res.paid) {
            cleanupPoll();
            queryClient.invalidateQueries({ queryKey: ["amc-status"] });
            toast.success("AMC payment successful");
          }
        } catch {
          // ignore polling errors
        }
      }, 4000);
    }, 150);
  }

  if (isLoading || data?.active) return null;

  const isAdmin = role === "admin";
  const expired = data && !data.active;
  const title = expired ? "AMC Plan Expired" : "AMC Plan Required";
  const message = expired
    ? `Your yearly maintenance plan expired on ${new Date(data.latestValidUntil!).toLocaleDateString()}. Renew now for ₹${data.amountInr}.`
    : `Yearly maintenance is required to keep the system running. Amount: ₹${data?.amountInr ?? 5999}.`;

  return (
    <>
      <div className="bg-amber-50 border-b-4 border-amber-500 px-4 py-3 shrink-0">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-center gap-3 text-center sm:text-left">
          <div className="flex items-center gap-2 text-amber-800">
            <AlertTriangleIcon className="w-5 h-5 shrink-0" />
            <span className="font-semibold text-sm">{title}</span>
          </div>
          <p className="text-sm text-amber-700">{message}</p>
          {isAdmin ? (
            <Button
              size="sm"
              className="bg-amber-600 hover:bg-amber-700 text-white shrink-0"
              onClick={() => setShowDialog(true)}
              disabled={orderMutation.isPending || verifyMutation.isPending}
            >
              {orderMutation.isPending ? (
                <Loader2Icon className="w-4 h-4 mr-2 animate-spin" />
              ) : null}
              Renew AMC
            </Button>
          ) : (
            <span className="text-xs text-amber-600 shrink-0">
              Contact admin to renew.
            </span>
          )}
        </div>
      </div>

      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="sm:max-w-md" onPointerDownOutside={(e) => e.preventDefault()}>
          <DialogHeader>
            <ShieldAlertIcon className="w-8 h-8 text-amber-500 mb-2" />
            <DialogTitle>Renew Yearly Maintenance</DialogTitle>
            <DialogDescription>
              Pay ₹{data?.amountInr ?? 5999} to keep the system active until 31st Dec {data?.year ?? new Date().getFullYear()} 23:59:59.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="flex justify-between text-sm border-b pb-2">
              <span className="text-slate-500">Plan</span>
              <span className="font-medium">Yearly AMC</span>
            </div>
            <div className="flex justify-between text-sm border-b pb-2">
              <span className="text-slate-500">Amount</span>
              <span className="font-medium">₹{data?.amountInr ?? 5999}</span>
            </div>
            <div className="flex justify-between text-sm border-b pb-2">
              <span className="text-slate-500">Valid until</span>
              <span className="font-medium">31st Dec {data?.year ?? new Date().getFullYear()} 23:59:59</span>
            </div>
            <div className="flex gap-3 justify-end pt-2">
              <Button
                onClick={() => setShowDialog(false)}
                variant="outline"
                size="sm"
              >
                Cancel
              </Button>
              <Button
                onClick={() => orderMutation.mutate()}
                disabled={orderMutation.isPending || verifyMutation.isPending}
                className="bg-amber-600 hover:bg-amber-700"
                size="sm"
              >
                {orderMutation.isPending ? (
                  <Loader2Icon className="w-4 h-4 mr-2 animate-spin" />
                ) : null}
                Pay with Razorpay
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
