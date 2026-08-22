import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useState, useRef } from "react";
import { useForm } from "react-hook-form";
import { useQuery } from "@tanstack/react-query";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { createRecord, saveDocument } from "@/lib/records.functions";
import { getAmcStatus } from "@/lib/amc.functions";
import { getUploadUrl, proxyUploadFile } from "@/lib/storage";
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
import { toast } from "sonner";
import {
  SendIcon,
  UploadCloudIcon,
  FileIcon,
  FileTextIcon,
  ImageIcon,
  XIcon,
  Loader2Icon,
} from "lucide-react";

export const Route = createFileRoute("/_app/records/new")({
  component: NewRecordPage,
});

const schema = z.object({
  deceased_name: z.string().min(1, "Name is required"),
  date_of_birth: z.string().optional(),
  date_of_death: z.string().min(1, "Date of death is required"),
  time_of_death: z.string().optional(),
  age_at_death: z.coerce.number().int().min(0).optional().or(z.literal("")),
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

// Pending file: selected locally, not yet uploaded
type PendingFile = { id: string; file: File; uploading?: boolean };

function NewRecordPage() {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [pendingFiles, setPendingFiles] = useState<PendingFile[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { data: amc } = useQuery({
    queryKey: ["amc-status"],
    queryFn: () => getAmcStatus(),
    refetchInterval: 60_000,
  });
  const amcActive = amc?.active ?? true;

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { deceased_name: "", date_of_death: "" },
  });
  const deceasedName = form.watch("deceased_name");

  const addFiles = (files: FileList | null) => {
    if (!files || !deceasedName.trim()) return;
    const newFiles: PendingFile[] = Array.from(files).map((f) => ({
      id: `${Date.now()}-${Math.random()}`,
      file: f,
    }));
    setPendingFiles((prev) => [...prev, ...newFiles]);
  };

  const removeFile = (id: string) =>
    setPendingFiles((prev) => prev.filter((f) => f.id !== id));

  const handleSave = async (status: "draft" | "submitted" = "submitted") => {
    if (!amcActive) {
      toast.error("AMC plan expired. Please renew to create records.");
      return;
    }
    const valid = await form.trigger();
    if (!valid) {
      toast.error("Please fix the errors before continuing");
      return;
    }
    const values = form.getValues();
    setSaving(true);
    try {
      // 1. Create the record
      const result = await createRecord({
        data: {
          ...values,
          age_at_death: values.age_at_death === "" ? undefined : Number(values.age_at_death),
          status,
        },
      });

      const recordId = result.id;

      // 2. Upload any pending files
      if (pendingFiles.length > 0) {
        const uploadResults = await Promise.allSettled(
          pendingFiles.map(async (pf) => {
            setPendingFiles((prev) =>
              prev.map((f) => (f.id === pf.id ? { ...f, uploading: true } : f))
            );

            const nameSlug = slugify(values.deceased_name || "unknown");
            const storageKey = `records/${recordId}/${nameSlug}/${Date.now()}-${pf.file.name}`;
            const contentType = pf.file.type || "application/octet-stream";

            const { url, useProxy } = await getUploadUrl({
              data: { key: storageKey, contentType },
            });

            if (!useProxy) {
              // R2 presigned upload
              await fetch(url, {
                method: "PUT",
                body: pf.file,
                headers: { "Content-Type": contentType },
              });
            } else {
              // Local disk proxy upload
              const ab = await pf.file.arrayBuffer();
              await proxyUploadFile({
                data: {
                  key: storageKey,
                  contentType,
                  base64: btoa(String.fromCharCode(...new Uint8Array(ab))),
                },
              });
            }

            await saveDocument({
              data: {
                recordId,
                fileName: pf.file.name,
                storagePath: storageKey,
                mimeType: pf.file.type,
                fileSize: pf.file.size,
              },
            });
          })
        );

        const failed = uploadResults.filter((r) => r.status === "rejected").length;
        if (failed > 0) toast.error(`${failed} file(s) failed to upload`);
      }

      toast.success(
        status === "submitted" ? "Record submitted for review" : "Record saved as draft"
      );
      router.navigate({ to: "/records/$id", params: { id: String(recordId) } });
    } catch (err: any) {
      toast.error(err.message ?? "Failed to save record");
    } finally {
      setSaving(false);
    }
  };

  const getFileIcon = (file: File) => {
    if (file.type.startsWith("image/")) return <ImageIcon className="w-4 h-4 text-blue-500" />;
    if (file.type === "application/pdf") return <FileTextIcon className="w-4 h-4 text-red-500" />;
    return <FileIcon className="w-4 h-4 text-slate-500" />;
  };

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-900">New Record</h1>
        <p className="text-slate-500 text-sm mt-0.5">Fill in the details for the cremation record</p>
      </div>

      <div className="space-y-5">
        {/* Deceased Personal Details */}
        <Card className="border border-slate-200 shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Deceased Personal Details</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Field label="Full Name *" error={form.formState.errors.deceased_name?.message}>
              <Input {...form.register("deceased_name")} placeholder="Full legal name" />
            </Field>

            <Field label="Gender">
              <Select onValueChange={(v) => form.setValue("gender", v as any)}>
                <SelectTrigger><SelectValue placeholder="Select gender" /></SelectTrigger>
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

            <Field label="Age at Death">
              <Input type="number" min={0} max={150} {...form.register("age_at_death")} placeholder="Age in years" />
            </Field>

            <Field label="Date of Death *" error={form.formState.errors.date_of_death?.message}>
              <Input type="date" {...form.register("date_of_death")} />
            </Field>

            <Field label="Time of Death">
              <Input type="time" {...form.register("time_of_death")} />
            </Field>

            <Field label="Nationality">
              <Input {...form.register("nationality")} placeholder="e.g. Indian" />
            </Field>

            <Field label="Religion">
              <Input {...form.register("religion")} placeholder="e.g. Hindu" />
            </Field>
          </CardContent>
        </Card>

        {/* Medical Details */}
        <Card className="border border-slate-200 shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Medical Details</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="md:col-span-2">
              <Field label="Cause of Death">
                <Textarea {...form.register("cause_of_death")} placeholder="Describe the cause of death" rows={3} />
              </Field>
            </div>
            <Field label="Place of Death">
              <Input {...form.register("place_of_death")} placeholder="Hospital / Address" />
            </Field>
            <Field label="Hospital / Facility Name">
              <Input {...form.register("hospital_name")} placeholder="Hospital name" />
            </Field>
          </CardContent>
        </Card>

        {/* Cremation Details */}
        <Card className="border border-slate-200 shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Cremation Details</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Field label="Cremation Date">
              <Input type="date" {...form.register("cremation_date")} />
            </Field>
            <Field label="Cremation Time">
              <Input type="time" {...form.register("cremation_time")} />
            </Field>
          </CardContent>
        </Card>

        {/* Family Contact */}
        <Card className="border border-slate-200 shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Family Contact</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Field label="Name">
              <Input {...form.register("next_of_kin_name")} placeholder="Full name" />
            </Field>
            <Field label="Relation to Deceased">
              <Input {...form.register("next_of_kin_relation")} placeholder="e.g. Son, Wife" />
            </Field>
            <Field label="Phone Number">
              <Input {...form.register("next_of_kin_phone")} placeholder="+91 ..." />
            </Field>
            <div className="md:col-span-2">
              <Field label="Address">
                <Textarea {...form.register("next_of_kin_address")} placeholder="Residential address" rows={2} />
              </Field>
            </div>
          </CardContent>
        </Card>

        {/* Additional Notes */}
        <Card className="border border-slate-200 shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Additional Notes</CardTitle>
          </CardHeader>
          <CardContent>
            <Textarea {...form.register("notes")} placeholder="Any other remarks or notes…" rows={3} />
          </CardContent>
        </Card>

        {/* Documents */}
        <Card className="border border-slate-200 shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">
              Documents {pendingFiles.length > 0 && `(${pendingFiles.length} selected)`}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {/* Hidden file input */}
            <input
              ref={fileInputRef}
              type="file"
              multiple
              className="hidden"
              disabled={!deceasedName.trim()}
              onChange={(e) => addFiles(e.target.files)}
              accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.txt"
            />

            {/* Dropzone */}
            <div
              className={`border-2 border-dashed rounded-xl p-6 text-center transition-colors ${
                deceasedName.trim()
                  ? "border-slate-200 cursor-pointer hover:border-slate-400 hover:bg-slate-50"
                  : "border-slate-200 bg-slate-50 cursor-not-allowed opacity-60"
              }`}
              onClick={() => deceasedName.trim() && fileInputRef.current?.click()}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => { e.preventDefault(); addFiles(e.dataTransfer.files); }}
            >
              <UploadCloudIcon className="w-8 h-8 text-slate-400 mx-auto mb-2" />
              <p className="text-sm text-slate-600 font-medium">
                {deceasedName.trim()
                  ? "Click or drag & drop to attach documents"
                  : "Enter deceased name above to enable document upload"}
              </p>
              {deceasedName.trim() && (
                <p className="text-xs text-slate-400 mt-1">
                  Aadhaar, death summary, ID proof, photos — PDF, Images, Word, Excel up to 50MB each
                </p>
              )}
            </div>

            {/* Selected files list */}
            {pendingFiles.length > 0 && (
              <div className="space-y-2">
                {pendingFiles.map((pf) => (
                  <div
                    key={pf.id}
                    className="flex items-center gap-3 p-3 bg-slate-50 rounded-lg border border-slate-200"
                  >
                    <div className="w-8 h-8 bg-white border border-slate-200 rounded-lg flex items-center justify-center shrink-0">
                      {pf.uploading
                        ? <Loader2Icon className="w-4 h-4 text-blue-500 animate-spin" />
                        : getFileIcon(pf.file)
                      }
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-slate-800 truncate">{pf.file.name}</p>
                      <p className="text-xs text-slate-400">{formatSize(pf.file.size)}</p>
                    </div>
                    {!pf.uploading && (
                      <button
                        type="button"
                        onClick={() => removeFile(pf.id)}
                        className="text-slate-400 hover:text-red-500 transition-colors"
                      >
                        <XIcon className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Actions */}
      <div className="flex items-center justify-end gap-3 pt-2 pb-6">
        <Button
          onClick={() => handleSave("submitted")}
          disabled={saving || !amcActive}
          title={amcActive ? undefined : "AMC plan expired. Renew to create records."}
          className="gap-2"
          size="lg"
        >
          {saving ? <Loader2Icon className="w-4 h-4 animate-spin" /> : <SendIcon className="w-4 h-4" />}
          {saving ? "Submitting…" : amcActive ? "Submit for Review" : "AMC Expired"}
        </Button>
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

function slugify(name: string) {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 50) || "unknown";
}
