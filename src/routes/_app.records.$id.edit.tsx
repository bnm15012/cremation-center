import { createFileRoute, useRouter, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { getRecord, updateRecord } from "@/lib/records.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { ArrowLeftIcon, SaveIcon, SendIcon } from "lucide-react";
import { formatIST } from "@/lib/date-utils";
import { differenceInMonths } from "date-fns";

export const Route = createFileRoute("/_app/records/$id/edit")({
  component: EditRecordPage,
});

const schema = z.object({
  deceased_name: z.string().min(1, "Name is required"),
  date_of_birth: z.string().optional(),
  date_of_death: z.string().min(1, "Date of death is required"),
  time_of_death: z.string().optional(),
  age_at_death: z.coerce.number().int().min(0).optional().or(z.literal("")),
  age_at_death_unit: z.enum(["years", "months"]).default("years"),
  gender: z.enum(["male", "female", "other"]).optional(),
  nationality: z.string().optional(),
  religion: z.string().optional(),
  place_of_death: z.string().optional(),
  cremation_date: z.string().optional(),
  cremation_time: z.string().optional(),

  next_of_kin_name: z.string().optional(),
  next_of_kin_phone: z.string().optional(),
  next_of_kin_relation: z.string().optional(),
  next_of_kin_address: z.string().optional(),
  cause_of_death: z.string().optional(),
  hospital_name: z.string().optional(),
  notes: z.string().optional(),
});

type FormValues = z.infer<typeof schema>;

function toDateInput(d: Date | null | undefined) {
  if (!d) return "";
  return formatIST(d, "yyyy-MM-dd");
}

function formatAge(value?: number | string | null, unit?: "years" | "months") {
  const num = Number(value);
  if (!unit || Number.isNaN(num) || value === "" || value == null) return "—";
  const totalMonths = unit === "years" ? num * 12 : num;
  const years = Math.floor(totalMonths / 12);
  const months = totalMonths % 12;
  if (years > 0 && months > 0) return `${years} years ${months} months`;
  if (years > 0) return `${years} years`;
  if (months > 0) return `${months} months`;
  return "—";
}

function EditRecordPage() {
  const { id } = Route.useParams();
  const router = useRouter();
  const qc = useQueryClient();
  const [saving, setSaving] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["record", id],
    queryFn: () => getRecord({ data: { id: Number(id) } }),
  });

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
  });
  const dateOfBirth = form.watch("date_of_birth");
  const dateOfDeath = form.watch("date_of_death");

  useEffect(() => {
    if (!dateOfBirth || !dateOfDeath) return;
    const months = differenceInMonths(new Date(dateOfDeath), new Date(dateOfBirth));
    if (months >= 0) {
      form.setValue("age_at_death", months, { shouldValidate: true });
      form.setValue("age_at_death_unit", "months", { shouldValidate: true });
    }
  }, [dateOfBirth, dateOfDeath, form]);

  useEffect(() => {
    if (data?.record) {
      const r = data.record;
      form.reset({
        deceased_name: r.deceased_name,
        date_of_birth: toDateInput(r.date_of_birth),
        date_of_death: toDateInput(r.date_of_death),
        time_of_death: r.time_of_death ?? "",
        age_at_death: r.age_at_death ?? undefined,
        age_at_death_unit: r.age_at_death_unit ?? "years",
        gender: r.gender ?? undefined,
        nationality: r.nationality ?? "",
        religion: r.religion ?? "",
        place_of_death: r.place_of_death ?? "",
        cremation_date: toDateInput(r.cremation_date),
        cremation_time: r.cremation_time ?? "",

        next_of_kin_name: r.next_of_kin_name ?? "",
        next_of_kin_phone: r.next_of_kin_phone ?? "",
        next_of_kin_relation: r.next_of_kin_relation ?? "",
        next_of_kin_address: r.next_of_kin_address ?? "",
        cause_of_death: r.cause_of_death ?? "",
        hospital_name: r.hospital_name ?? "",
        notes: r.notes ?? "",
      });
    }
  }, [data]);

  const handleSave = async (status?: "draft" | "submitted") => {
    const valid = await form.trigger();
    if (!valid) {
      toast.error("Please fix the errors before continuing");
      return;
    }
    const values = form.getValues();
    setSaving(true);
    try {
      await updateRecord({
        data: {
          id: Number(id),
          ...values,
          age_at_death: values.age_at_death === "" ? undefined : Number(values.age_at_death),
          ...(status ? { status } : {}),
        },
      });
      toast.success("Record updated");
      await qc.invalidateQueries({ queryKey: ["record", id] });
      await qc.invalidateQueries({ queryKey: ["records"] });
      await qc.invalidateQueries({ queryKey: ["dashboard-stats"] });
      router.navigate({ to: "/records/$id", params: { id } });
    } catch (err: any) {
      toast.error(err.message ?? "Failed to update record");
    } finally {
      setSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="p-6 max-w-4xl mx-auto space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-64 w-full rounded-xl" />
      </div>
    );
  }

  const record = data?.record;
  if (!record) {
    return (
      <div className="p-6 text-center py-20">
        <p className="text-slate-600">Record not found</p>
      </div>
    );
  }

  const genderValue = form.watch("gender");

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <Link to="/records/$id" params={{ id }}>
          <Button variant="ghost" size="icon" className="h-8 w-8">
            <ArrowLeftIcon className="w-4 h-4" />
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Edit Record</h1>
          <p className="text-slate-500 text-sm mt-0.5">{record.deceased_name}</p>
        </div>
      </div>

      <div className="space-y-5">
        <Card className="border border-slate-200 shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Deceased Personal Details</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Field label="Full Name *" error={form.formState.errors.deceased_name?.message}>
              <Input {...form.register("deceased_name")} />
            </Field>

            <Field label="Gender">
              <Select
                value={genderValue}
                onValueChange={(v) => form.setValue("gender", v as any)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select gender" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="male">Male</SelectItem>
                  <SelectItem value="female">Female</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </Field>

            <Field label="Date of Birth">
              <Input type="date" {...form.register("date_of_birth")} />
            </Field>

            <Field label="Date of Death *" error={form.formState.errors.date_of_death?.message}>
              <Input type="date" {...form.register("date_of_death")} />
            </Field>

            <Field label="Age at Death">
              <div className="h-10 px-3 rounded-md border border-slate-200 bg-slate-50 flex items-center text-sm text-slate-700">
                {formatAge(form.watch("age_at_death"), form.watch("age_at_death_unit"))}
              </div>
            </Field>

            <Field label="Time of Death">
              <Input type="time" {...form.register("time_of_death")} />
            </Field>

            <Field label="Nationality">
              <Input {...form.register("nationality")} />
            </Field>

            <Field label="Religion">
              <Input {...form.register("religion")} />
            </Field>
          </CardContent>
        </Card>

        <Card className="border border-slate-200 shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Medical Details</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="md:col-span-2">
              <Field label="Cause of Death">
                <Textarea {...form.register("cause_of_death")} rows={3} />
              </Field>
            </div>
            <Field label="Place of Death">
              <Input {...form.register("place_of_death")} />
            </Field>
            <Field label="Hospital / Facility Name">
              <Input {...form.register("hospital_name")} />
            </Field>
          </CardContent>
        </Card>

        <Card className="border border-slate-200 shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Cremation Details</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Field label="Cremation Date">
              <Input type="date" {...form.register("cremation_date")} />
            </Field>
            <Field label="Cremation Time">
              <Input type="time" {...form.register("cremation_time")} />
            </Field>

          </CardContent>
        </Card>

        <Card className="border border-slate-200 shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Family Contact</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Field label="Name">
              <Input {...form.register("next_of_kin_name")} />
            </Field>
            <Field label="Relation">
              <Input {...form.register("next_of_kin_relation")} />
            </Field>
            <Field label="Phone">
              <Input {...form.register("next_of_kin_phone")} />
            </Field>
            <div className="md:col-span-2">
              <Field label="Address">
                <Textarea {...form.register("next_of_kin_address")} rows={2} />
              </Field>
            </div>
          </CardContent>
        </Card>

        <Card className="border border-slate-200 shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Additional Notes</CardTitle>
          </CardHeader>
          <CardContent>
            <Textarea {...form.register("notes")} rows={3} />
          </CardContent>
        </Card>
      </div>

      <div className="flex items-center justify-end gap-3 pt-2 pb-6">
        <Button
          variant="outline"
          onClick={() => handleSave()}
          disabled={saving}
          className="gap-2"
        >
          <SaveIcon className="w-4 h-4" />
          Save Changes
        </Button>
        {(record.status === "draft" || record.status === "rejected") && (
          <Button
            onClick={() => handleSave("submitted")}
            disabled={saving}
            className="gap-2"
          >
            <SendIcon className="w-4 h-4" />
            Save & Submit
          </Button>
        )}
      </div>
    </div>
  );
}

function Field({
  label,
  children,
  error,
}: {
  label: string;
  children: React.ReactNode;
  error?: string;
}) {
  return (
    <div className="space-y-1.5">
      <Label className="text-sm text-slate-700">{label}</Label>
      {children}
      {error && <p className="text-xs text-red-500">{error}</p>}
    </div>
  );
}
