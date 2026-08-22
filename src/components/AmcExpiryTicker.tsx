import { useQuery } from "@tanstack/react-query";
import { getAmcStatus } from "@/lib/amc.functions";
import { formatIST } from "@/lib/date-utils";
import { AlertTriangleIcon } from "lucide-react";

type AmcExpiryTickerProps = {
  role: "admin" | "staff";
};

export function AmcExpiryTicker({ role }: AmcExpiryTickerProps) {
  const { data, isLoading } = useQuery({
    queryKey: ["amc-status"],
    queryFn: () => getAmcStatus(),
    refetchInterval: 60_000,
  });

  if (isLoading || !data?.isExpiringSoon) return null;

  const validUntil = data.latestValidUntil
    ? formatIST(data.latestValidUntil, "dd MMM yyyy")
    : "31st Dec";

  const action = role === "admin" ? "Renew now" : "Contact admin to renew";
  const message =
    data.daysUntilExpiry === 1
      ? `AMC expires tomorrow (${validUntil}). ${action} to avoid interruption.`
      : data.daysUntilExpiry === 0
      ? `AMC expires today (${validUntil}). ${action} to avoid interruption.`
      : `AMC expires in ${data.daysUntilExpiry} days (${validUntil}). ${action} to avoid interruption.`;

  return (
    <div className="bg-amber-100 border-y border-amber-300 overflow-hidden py-2 relative">
      <div className="animate-marquee whitespace-nowrap inline-flex items-center gap-2 text-amber-800 text-sm font-medium">
        <AlertTriangleIcon className="w-4 h-4 shrink-0" />
        <span>{message}</span>
      </div>
    </div>
  );
}
