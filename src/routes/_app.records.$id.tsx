import { createFileRoute, useRouter, Link, useLocation, Outlet } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getRecord, approveRecord, rejectRecord, submitRecord, deleteRecord, deleteDocument, saveDocument } from "@/lib/records.functions";
import { getUploadUrl, proxyUploadFile, getDownloadUrl, deleteStorageFile } from "@/lib/storage";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import {
  ArrowLeftIcon,
  CheckCircleIcon,
  XCircleIcon,
  SendIcon,
  PencilIcon,
  UploadCloudIcon,
  FileIcon,
  DownloadIcon,
  TrashIcon,
  FileTextIcon,
  Loader2Icon,
  ImageIcon,
  FilePdfIcon,
  ScrollTextIcon,
} from "lucide-react";
import { format } from "date-fns";
import { useState, useRef } from "react";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_app/records/$id")({
  component: RecordDetailPage,
});

const statusColors: Record<string, string> = {
  draft: "bg-gray-100 text-gray-700 border-gray-200",
  submitted: "bg-amber-50 text-amber-700 border-amber-200",
  approved: "bg-green-50 text-green-700 border-green-200",
  rejected: "bg-red-50 text-red-700 border-red-200",
};

function RecordDetailPage() {
  const { id } = Route.useParams();
  const router = useRouter();
  const qc = useQueryClient();
  const [rejectDialogOpen, setRejectDialogOpen] = useState(false);
  const [rejectReason, setRejectReason] = useState("");
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [docToDelete, setDocToDelete] = useState<{ id: number; storagePath: string; fileName: string } | null>(null);
  const [uploadingFiles, setUploadingFiles] = useState<string[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { data, isLoading, error } = useQuery({
    queryKey: ["record", id],
    queryFn: () => getRecord({ data: { id: Number(id) } }),
  });

  const { pathname } = useLocation();
  if (pathname.endsWith("/certificate")) {
    return <Outlet />;
  }

  const invalidate = () => qc.invalidateQueries({ queryKey: ["record", id] });

  const approveMut = useMutation({
    mutationFn: () => approveRecord({ data: { id: Number(id) } }),
    onSuccess: () => { toast.success("Record approved"); invalidate(); },
    onError: (e: any) => toast.error(e.message),
  });

  const rejectMut = useMutation({
    mutationFn: () => rejectRecord({ data: { id: Number(id), reason: rejectReason } }),
    onSuccess: () => { toast.success("Record rejected"); setRejectDialogOpen(false); invalidate(); },
    onError: (e: any) => toast.error(e.message),
  });

  const submitMut = useMutation({
    mutationFn: () => submitRecord({ data: { id: Number(id) } }),
    onSuccess: () => { toast.success("Record submitted for review"); invalidate(); },
    onError: (e: any) => toast.error(e.message),
  });

  const deleteMut = useMutation({
    mutationFn: () => deleteRecord({ data: { recordId: Number(id) } }),
    onSuccess: () => {
      toast.success("Record deleted");
      qc.invalidateQueries({ queryKey: ["dashboard-stats"] });
      qc.invalidateQueries({ queryKey: ["records"] });
      router.navigate({ to: "/records" });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const handleFileUpload = async (files: FileList | null) => {
    if (!files || files.length === 0) return;

    for (const file of Array.from(files)) {
      const fileId = `${Date.now()}-${file.name}`;
      setUploadingFiles((prev) => [...prev, fileId]);

      try {
        const nameSlug = slugify(record.deceased_name ?? "unknown");
        const storagePath = `records/${id}/${nameSlug}/${Date.now()}-${file.name.replace(/\s+/g, "-")}`;
        const contentType = file.type || "application/octet-stream";

        const { url, useProxy } = await getUploadUrl({
          data: { key: storagePath, contentType },
        });

        if (!useProxy) {
          // R2 presigned upload
          const res = await fetch(url, {
            method: "PUT",
            body: file,
            headers: { "Content-Type": contentType },
          });
          if (!res.ok) throw new Error("Upload failed");
        } else {
          // Local disk proxy upload
          const base64 = await fileToBase64(file);
          await proxyUploadFile({
            data: { key: storagePath, contentType, base64 },
          });
        }

        await saveDocument({
          data: {
            recordId: Number(id),
            fileName: file.name,
            storagePath,
            mimeType: contentType,
            fileSize: file.size,
          },
        });
        toast.success(`${file.name} uploaded`);
        invalidate();
      } catch (err: any) {
        toast.error(`Failed to upload ${file.name}: ${err.message}`);
      } finally {
        setUploadingFiles((prev) => prev.filter((f) => f !== fileId));
      }
    }
  };

  const handleDownload = async (storagePath: string, fileName: string) => {
    try {
      const { url } = await getDownloadUrl({ data: { storagePath, fileName } });
      window.open(url, "_blank");
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const handleDeleteDoc = async () => {
    if (!docToDelete) return;
    try {
      await deleteDocument({ data: { documentId: docToDelete.id } });
      await deleteStorageFile({ data: { storagePath: docToDelete.storagePath } });
      toast.success(`${docToDelete.fileName} deleted`);
      invalidate();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setDocToDelete(null);
    }
  };

  if (isLoading) {
    return (
      <div className="p-6 max-w-4xl mx-auto space-y-4">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-64 w-full rounded-xl" />
        <Skeleton className="h-48 w-full rounded-xl" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="p-6 max-w-4xl mx-auto text-center py-20">
        <p className="text-slate-600">{(error as any)?.message ?? "Record not found"}</p>
        <Link to="/records" className="mt-4 inline-block">
          <Button variant="outline" size="sm">Back to Records</Button>
        </Link>
      </div>
    );
  }

  const { record, creator, reviewer, documents, isAdmin } = data;
  const canEdit =
    !isAdmin && (record.status === "draft" || record.status === "rejected");
  const canSubmit = !isAdmin && (record.status === "draft" || record.status === "rejected");
  const canApproveReject = isAdmin && record.status === "submitted";
  const canUpload = record.status !== "approved";

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <Link to="/records">
            <Button variant="ghost" size="icon" className="h-8 w-8">
              <ArrowLeftIcon className="w-4 h-4" />
            </Button>
          </Link>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-xl font-bold text-slate-900">{record.deceased_name}</h1>
              <Badge
                className={`text-xs capitalize border ${statusColors[record.status] ?? ""}`}
                variant="outline"
              >
                {record.status}
              </Badge>
            </div>
            <p className="text-slate-500 text-sm mt-0.5">
              Record #{record.id} · Created by {creator}
              {reviewer ? ` · Reviewed by ${reviewer}` : ""}
            </p>
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-2 flex-wrap">
          {canEdit && (
            <Link to="/records/$id/edit" params={{ id }}>
              <Button variant="outline" size="sm" className="gap-2">
                <PencilIcon className="w-4 h-4" />
                Edit
              </Button>
            </Link>
          )}
          {canSubmit && (
            <Button
              size="sm"
              className="gap-2"
              onClick={() => submitMut.mutate()}
              disabled={submitMut.isPending}
            >
              <SendIcon className="w-4 h-4" />
              Submit for Review
            </Button>
          )}
          {canApproveReject && (
            <>
              <Button
                size="sm"
                variant="outline"
                className="gap-2 border-red-200 text-red-600 hover:bg-red-50"
                onClick={() => setRejectDialogOpen(true)}
              >
                <XCircleIcon className="w-4 h-4" />
                Reject
              </Button>
              <Button
                size="sm"
                className="gap-2 bg-green-600 hover:bg-green-700"
                onClick={() => approveMut.mutate()}
                disabled={approveMut.isPending}
              >
                <CheckCircleIcon className="w-4 h-4" />
                Approve
              </Button>
            </>
          )}
          {isAdmin && record.status === "approved" && (
            <Link to="/records/$id/certificate" params={{ id }}>
              <Button
                size="sm"
                variant="outline"
                className="gap-2 border-slate-300 text-slate-700 hover:bg-slate-50"
              >
                <ScrollTextIcon className="w-4 h-4" />
                Generate Certificate
              </Button>
            </Link>
          )}
          {isAdmin && (
            <Button
              size="sm"
              variant="outline"
              className="gap-2 border-red-200 text-red-600 hover:bg-red-50"
              onClick={() => setDeleteDialogOpen(true)}
            >
              <TrashIcon className="w-4 h-4" />
              Delete
            </Button>
          )}
        </div>
      </div>

      {/* Rejection reason banner */}
      {record.status === "rejected" && record.rejection_reason && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4">
          <p className="text-sm font-medium text-red-700 mb-1">Rejection Reason</p>
          <p className="text-sm text-red-600">{record.rejection_reason}</p>
        </div>
      )}

      {/* Personal Details */}
      <Card className="border border-slate-200 shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Deceased Personal Details</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-2 md:grid-cols-3 gap-4">
          <Detail label="Full Name" value={record.deceased_name} />
          <Detail label="Gender" value={record.gender} />
          <Detail label="Date of Birth" value={record.date_of_birth ? format(new Date(record.date_of_birth), "dd MMM yyyy") : null} />
          <Detail label="Age at Death" value={record.age_at_death != null ? formatAge(record.age_at_death, record.age_at_death_unit) : null} />
          <Detail label="Date of Death" value={record.date_of_death ? format(new Date(record.date_of_death), "dd MMM yyyy") : null} />
          <Detail label="Time of Death" value={record.time_of_death} />
          <Detail label="Nationality" value={record.nationality} />
          <Detail label="Religion" value={record.religion} />
        </CardContent>
      </Card>

      {/* Medical Details */}
      <Card className="border border-slate-200 shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Medical Details</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Detail label="Cause of Death" value={record.cause_of_death} className="md:col-span-2" />
          <Detail label="Place of Death" value={record.place_of_death} />
          <Detail label="Death Certificate No." value={record.death_certificate_no} />
          <Detail label="Doctor Name" value={record.doctor_name} />
          <Detail label="Hospital / Facility" value={record.hospital_name} />
        </CardContent>
      </Card>

      {/* Cremation Details */}
      <Card className="border border-slate-200 shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Cremation Details</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-2 md:grid-cols-3 gap-4">
          <Detail
            label="Cremation Date"
            value={record.cremation_date ? format(new Date(record.cremation_date), "dd MMM yyyy") : null}
          />
          <Detail label="Cremation Time" value={record.cremation_time} />

        </CardContent>
      </Card>

      {/* Next of Kin */}
      <Card className="border border-slate-200 shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Family Contact</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Detail label="Name" value={record.next_of_kin_name} />
          <Detail label="Relation" value={record.next_of_kin_relation} />
          <Detail label="Phone" value={record.next_of_kin_phone} />
          <Detail label="Address" value={record.next_of_kin_address} className="md:col-span-2" />
        </CardContent>
      </Card>

      {/* Notes */}
      {record.notes && (
        <Card className="border border-slate-200 shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Notes</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-slate-700 whitespace-pre-wrap">{record.notes}</p>
          </CardContent>
        </Card>
      )}

      {/* Documents */}
      <Card className="border border-slate-200 shadow-sm">
        <CardHeader className="flex flex-row items-center justify-between pb-3">
          <CardTitle className="text-base">Documents ({documents.length})</CardTitle>
          {canUpload && (
            <Button
              variant="outline"
              size="sm"
              className="gap-2"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploadingFiles.length > 0}
            >
              {uploadingFiles.length > 0 ? (
                <Loader2Icon className="w-4 h-4 animate-spin" />
              ) : (
                <UploadCloudIcon className="w-4 h-4" />
              )}
              Upload
            </Button>
          )}
        </CardHeader>
        <CardContent>
          <input
            ref={fileInputRef}
            type="file"
            multiple
            className="hidden"
            onChange={(e) => handleFileUpload(e.target.files)}
            accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.txt"
          />

          {/* Upload dropzone */}
          {canUpload && (
            <div
              className="border-2 border-dashed border-slate-200 rounded-xl p-6 text-center mb-4 cursor-pointer hover:border-slate-400 hover:bg-slate-50 transition-colors"
              onClick={() => fileInputRef.current?.click()}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                handleFileUpload(e.dataTransfer.files);
              }}
            >
              <UploadCloudIcon className="w-8 h-8 text-slate-400 mx-auto mb-2" />
              <p className="text-sm text-slate-600 font-medium">
                Click or drag & drop to upload documents
              </p>
              <p className="text-xs text-slate-400 mt-1">
                Aadhaar, death summary, ID proof, photos — PDF, Images, Word, Excel up to 50MB each
              </p>
            </div>
          )}

          {/* Uploading indicators */}
          {uploadingFiles.map((f) => (
            <div
              key={f}
              className="flex items-center gap-3 p-3 bg-blue-50 rounded-lg mb-2 animate-pulse"
            >
              <Loader2Icon className="w-5 h-5 text-blue-500 animate-spin" />
              <p className="text-sm text-blue-700">Uploading…</p>
            </div>
          ))}

          {/* Document list */}
          {documents.length === 0 && uploadingFiles.length === 0 ? (
            <p className="text-sm text-slate-400 text-center py-4">No documents uploaded yet — upload Aadhaar, death summary, ID proof, etc.</p>
          ) : (
            <div className="space-y-2">
              {documents.map((doc) => (
                <div
                  key={doc.id}
                  className="flex items-center gap-3 p-3 bg-slate-50 rounded-lg border border-slate-200"
                >
                  <div className="w-9 h-9 bg-white border border-slate-200 rounded-lg flex items-center justify-center shrink-0">
                    {doc.mime_type?.startsWith("image/") ? (
                      <ImageIcon className="w-4 h-4 text-blue-500" />
                    ) : doc.mime_type === "application/pdf" ? (
                      <FileTextIcon className="w-4 h-4 text-red-500" />
                    ) : (
                      <FileIcon className="w-4 h-4 text-slate-500" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-slate-900 truncate">
                      {doc.file_name}
                    </p>
                    <p className="text-xs text-slate-400">
                      {formatFileSize(doc.file_size)} ·{" "}
                      {format(new Date(doc.created_at), "dd MMM yyyy, h:mm a")}
                    </p>
                  </div>
                  <div className="flex gap-1 shrink-0">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-slate-500 hover:text-slate-700"
                      onClick={() => handleDownload(doc.storage_path, doc.file_name)}
                    >
                      <DownloadIcon className="w-4 h-4" />
                    </Button>
                    {(isAdmin || canUpload) && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-slate-500 hover:text-red-600"
                        onClick={() => setDocToDelete({ id: doc.id, storagePath: doc.storage_path, fileName: doc.file_name })}
                      >
                        <TrashIcon className="w-4 h-4" />
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Reject Dialog */}
      <Dialog open={rejectDialogOpen} onOpenChange={setRejectDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reject Record</DialogTitle>
            <DialogDescription>
              Provide a reason for rejection. The staff member will be able to edit and
              resubmit after reviewing your feedback.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label>Rejection Reason *</Label>
            <Textarea
              rows={4}
              placeholder="Describe what needs to be corrected…"
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejectDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => rejectMut.mutate()}
              disabled={!rejectReason.trim() || rejectMut.isPending}
            >
              Reject Record
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Document Dialog */}
      <AlertDialog open={!!docToDelete} onOpenChange={(open) => !open && setDocToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this document?</AlertDialogTitle>
            <AlertDialogDescription>
              {docToDelete ? (
                <>
                  <span className="font-medium text-slate-700">{docToDelete.fileName}</span> will be
                  permanently deleted. This action cannot be undone.
                </>
              ) : null}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setDocToDelete(null)}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteDoc}
              className="bg-red-600 hover:bg-red-700"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete Record Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this record?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete the record and all uploaded documents. This action
              cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setDeleteDialogOpen(false)}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteMut.mutate()}
              className="bg-red-600 hover:bg-red-700"
              disabled={deleteMut.isPending}
            >
              {deleteMut.isPending ? "Deleting…" : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
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

function slugify(name: string) {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 50) || "unknown";
}

function Detail({
  label,
  value,
  className,
}: {
  label: string;
  value?: string | number | null;
  className?: string;
}) {
  return (
    <div className={cn("space-y-0.5", className)}>
      <p className="text-xs text-slate-400 uppercase tracking-wide">{label}</p>
      <p className={cn("text-sm font-medium", value ? "text-slate-900" : "text-slate-300")}>
        {value ?? "—"}
      </p>
    </div>
  );
}

function formatFileSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

async function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      resolve(result.split(",")[1]);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}
