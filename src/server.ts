import path from "node:path";
import fs from "node:fs/promises";

type ServerEntry = {
  fetch: (request: Request, env: unknown, ctx: unknown) => Promise<Response> | Response;
};

let serverEntryPromise: Promise<ServerEntry> | undefined;

async function getServerEntry(): Promise<ServerEntry> {
  if (!serverEntryPromise) {
    serverEntryPromise = import("@tanstack/react-start/server-entry").then(
      (m) => (m.default ?? m) as ServerEntry,
    );
  }
  return serverEntryPromise;
}

const LOCAL_UPLOADS_DIR = path.join(process.cwd(), "uploads");

function localFilePath(key: string) {
  const safe = key.replace(/\.\.\//g, "").replace(/^\/+/, "");
  return path.join(LOCAL_UPLOADS_DIR, safe.replace(/\//g, "__"));
}

async function handleLocalFile(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const key = url.searchParams.get("key");
  const name = url.searchParams.get("name") ?? "file";

  if (!key) return new Response("Missing key", { status: 400 });

  try {
    const buffer = await fs.readFile(localFilePath(key));
    const ext = path.extname(name).toLowerCase();
    const mimeTypes: Record<string, string> = {
      ".pdf": "application/pdf",
      ".jpg": "image/jpeg",
      ".jpeg": "image/jpeg",
      ".png": "image/png",
      ".gif": "image/gif",
      ".webp": "image/webp",
      ".doc": "application/msword",
      ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      ".xls": "application/vnd.ms-excel",
      ".xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      ".txt": "text/plain",
    };
    const contentType = mimeTypes[ext] ?? "application/octet-stream";
    return new Response(buffer, {
      headers: {
        "Content-Type": contentType,
        "Content-Disposition": `inline; filename="${name}"`,
        "Cache-Control": "private, max-age=3600",
      },
    });
  } catch {
    return new Response("File not found", { status: 404 });
  }
}

export default {
  async fetch(request: Request, env: unknown, ctx: unknown) {
    try {
      const url = new URL(request.url);

      // Dev-only: serve locally uploaded files
      if (url.pathname === "/api/local-file") {
        return await handleLocalFile(request);
      }

      const handler = await getServerEntry();
      return await handler.fetch(request, env, ctx);
    } catch (error) {
      console.error(error);
      return new Response("Internal Server Error", { status: 500 });
    }
  },
};
