import { createFileRoute, useParams, useRouter, Navigate, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { getRecord } from "@/lib/records.functions";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import { ArrowLeftIcon, PrinterIcon, Loader2Icon } from "lucide-react";

export const Route = createFileRoute("/_app/records/$id/certificate")({
  component: CertificatePage,
});

function fmt(d: string | Date | null | undefined, f = "dd MMMM yyyy") {
  if (!d) return "—";
  try { return format(new Date(d), f); } catch { return "—"; }
}

function formatAge(value: number, unit: "years" | "months") {
  const totalMonths = unit === "years" ? value * 12 : value;
  const years = Math.floor(totalMonths / 12);
  const months = totalMonths % 12;
  if (years > 0 && months > 0) return `${years} years ${months} months`;
  if (years > 0) return `${years} years`;
  if (months > 0) return `${months} months`;
  return "0 months";
}

function CertificatePage() {
  const { id } = useParams({ from: "/_app/records/$id/certificate" });
  const router = useRouter();
  const { data, isLoading, error } = useQuery({
    queryKey: ["record", id],
    queryFn: () => getRecord({ data: { id: Number(id) } }),
  });

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-100 flex items-center justify-center">
        <Loader2Icon className="w-8 h-8 text-slate-400 animate-spin" />
      </div>
    );
  }

  if (error || !data?.record) {
    return (
      <div className="min-h-screen bg-slate-100 p-6 text-center">
        <p className="text-slate-600">{error ? (error as any).message : "Record not found"}</p>
        <Button onClick={() => router.navigate({ to: "/records" })} className="mt-4">
          Back to Records
        </Button>
      </div>
    );
  }

  if (!data.isAdmin) {
    return <Navigate to="/dashboard" />;
  }

  const { record } = data;

  return (
    <div className="min-h-screen bg-slate-100">
      {/* Action bar — hidden on print */}
      <div className="print:hidden flex items-center gap-3 px-6 py-3 bg-white border-b border-slate-200 shadow-sm">
        <Link to="/records/$id" params={{ id: String(record.id) }}>
          <Button variant="ghost" size="sm" className="gap-2">
            <ArrowLeftIcon className="w-4 h-4" />
            Back
          </Button>
        </Link>
        <span className="text-sm text-slate-500 flex-1">
          Cremation Certificate — <strong>{record.deceased_name}</strong>
        </span>
        <Button
          className="gap-2"
          onClick={() => window.print()}
        >
          <PrinterIcon className="w-4 h-4" />
          Print Certificate
        </Button>
      </div>

      {/* A4 Certificate */}
      <div className="flex justify-center py-8 print:py-0 print:block">
        <div
          id="certificate"
          className="
            bg-white w-[210mm] min-h-[297mm]
            print:w-full print:min-h-full print:shadow-none
            shadow-2xl
            relative p-[18mm] box-border
            font-serif
          "
        >
          {/* Outer decorative border */}
          <div className="absolute inset-[6mm] border-[3px] border-slate-800 pointer-events-none" />
          <div className="absolute inset-[9mm] border-[1px] border-slate-400 pointer-events-none" />

          {/* Header */}
          <div className="text-center mb-8 relative z-10">
            {/* Logo / seal area */}
            <div className="flex justify-center mb-3">
              <div className="w-20 h-20 rounded-full border-4 border-slate-800 flex items-center justify-center bg-slate-50">
                <svg viewBox="0 0 48 48" className="w-12 h-12 text-slate-800" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M24 4 C14 4 8 14 8 24 C8 34 14 42 24 44 C34 42 40 34 40 24 C40 14 34 4 24 4Z" />
                  <path d="M24 12 L24 36 M16 20 C16 20 20 16 24 12 C28 16 32 20 32 20" />
                  <path d="M18 32 L30 32" />
                </svg>
              </div>
            </div>
            <p className="text-xs tracking-[0.3em] uppercase text-slate-500 mb-1">Cremation System — Record Management</p>
            <h1 className="text-3xl font-bold tracking-wide text-slate-900 uppercase">
              Cremation Certificate
            </h1>
            <div className="flex items-center justify-center gap-3 mt-2">
              <div className="h-px flex-1 bg-slate-800 max-w-[80px]" />
              <span className="text-slate-400 text-xs">✦</span>
              <div className="h-px flex-1 bg-slate-800 max-w-[80px]" />
            </div>
          </div>

          {/* Intro line */}
          <p className="text-center text-sm text-slate-600 mb-8 leading-relaxed">
            This is to certify that the cremation of the below-mentioned deceased
            was conducted at this centre as per the details recorded herein.
          </p>

          {/* ── Section 1: Deceased Details ── */}
          <SectionTitle>Deceased Details</SectionTitle>
          <table className="w-full text-sm mb-6 border-collapse">
            <tbody>
              <Row label="Full Name" value={record.deceased_name} highlight />
              <Row label="Date of Birth" value={fmt(record.date_of_birth)} />
              <Row label="Date of Death" value={fmt(record.date_of_death)} />
              <Row label="Time of Death" value={record.time_of_death ?? "—"} />
              <Row label="Age at Death" value={record.age_at_death != null ? formatAge(record.age_at_death, record.age_at_death_unit) : "—"} />
              <Row label="Gender" value={record.gender ? record.gender.charAt(0).toUpperCase() + record.gender.slice(1) : "—"} />
              <Row label="Nationality" value={record.nationality ?? "—"} />
              <Row label="Religion" value={record.religion ?? "—"} />
              <Row label="Place of Death" value={record.place_of_death ?? "—"} />
            </tbody>
          </table>

          {/* ── Section 2: Cremation Details ── */}
          <SectionTitle>Cremation Details</SectionTitle>
          <table className="w-full text-sm mb-6 border-collapse">
            <tbody>
              <Row label="Cremation Date" value={fmt(record.cremation_date)} />
              <Row label="Cremation Time" value={record.cremation_time ?? "—"} />

            </tbody>
          </table>

          {/* ── Section 3: Medical Details ── */}
          <SectionTitle>Medical Details</SectionTitle>
          <table className="w-full text-sm mb-6 border-collapse">
            <tbody>
              <Row label="Cause of Death" value={record.cause_of_death ?? "—"} />
              <Row label="Attending Doctor" value={record.doctor_name ?? "—"} />
              <Row label="Hospital / Institution" value={record.hospital_name ?? "—"} />
              <Row label="Death Certificate No." value={record.death_certificate_no ?? "—"} />
            </tbody>
          </table>

          {/* ── Section 4: Family Contact ── */}
          <SectionTitle>Family Contact</SectionTitle>
          <table className="w-full text-sm mb-8 border-collapse">
            <tbody>
              <Row label="Name" value={record.next_of_kin_name ?? "—"} />
              <Row label="Relation" value={record.next_of_kin_relation ?? "—"} />
              <Row label="Phone" value={record.next_of_kin_phone ?? "—"} />
              <Row label="Address" value={record.next_of_kin_address ?? "—"} />
            </tbody>
          </table>

          {/* Certificate No & Date Issued */}
          <div className="flex justify-between text-xs text-slate-500 mb-10 border-t border-slate-200 pt-4">
            <span>Certificate Ref: <strong className="text-slate-700">AK-{String(record.id).padStart(6, "0")}</strong></span>
            <span>Issued on: <strong className="text-slate-700">{format(new Date(), "dd MMMM yyyy")}</strong></span>
          </div>

          {/* Signature block */}
          <div className="flex justify-between items-end gap-8 mt-4">
            {/* Applicant / Next of kin */}
            <div className="flex-1 text-center">
              <div className="border-b border-slate-800 mb-1 h-10" />
              <p className="text-xs text-slate-600">Signature of Family Contact</p>
              <p className="text-xs text-slate-400 mt-0.5">{record.next_of_kin_name ?? ""}</p>
            </div>

            {/* Stamp area */}
            <div className="w-24 h-24 border-2 border-dashed border-slate-300 rounded-full flex items-center justify-center shrink-0">
              <p className="text-[9px] text-slate-300 text-center leading-tight">Office<br />Stamp</p>
            </div>

            {/* Authorised signatory */}
            <div className="flex-1 text-center">
              <div className="border-b border-slate-800 mb-1 h-10" />
              <p className="text-xs text-slate-600">Authorised Signatory</p>
              <p className="text-xs text-slate-400 mt-0.5">Cremation Centre Manager</p>
            </div>
          </div>

          {/* Footer */}
          <p className="text-center text-[10px] text-slate-400 mt-6">
            This certificate is issued by Cremation System and is valid only with an authorised signature and official stamp.
          </p>
        </div>
      </div>

      {/* Print styles */}
      <style>{`
        @media print {
          @page { size: A4 portrait; margin: 0; }
          body { margin: 0; background: white; }
          .print\\:hidden { display: none !important; }
          #certificate { box-shadow: none; }
        }
      `}</style>
    </div>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2 mb-2">
      <h3 className="text-xs font-bold uppercase tracking-widest text-slate-500">{children}</h3>
      <div className="flex-1 h-px bg-slate-200" />
    </div>
  );
}

function Row({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <tr className="border-b border-slate-100 last:border-0">
      <td className="py-1.5 pr-4 text-slate-500 font-sans w-[38%] text-xs align-top">{label}</td>
      <td className={`py-1.5 font-sans align-top ${highlight ? "font-bold text-slate-900 text-base" : "text-slate-800"}`}>
        {value}
      </td>
    </tr>
  );
}
