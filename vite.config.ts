import { jsxLocPlugin } from "@builder.io/vite-plugin-jsx-loc";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import { defineConfig, type Plugin, type ViteDevServer } from "vite";
import { vitePluginManusRuntime } from "vite-plugin-manus-runtime";
import { storagePut } from "./server/storage";
import { loadMonsterData, mergeMonsterMetadata, saveMonsterData } from "./server/monsterDataStore";
import { PROTECTED_MONSTER_IMAGE_HEADERS, readProtectedMonsterImage } from "./server/protectedMonsterImage";
import { vitePluginMemberAuth } from "./server/viteMemberAuthPlugin";
import { vitePluginMarketplaceApi } from "./server/viteMarketplacePlugin";

// =============================================================================
// Manus Debug Collector - Vite Plugin
// Writes browser logs directly to files, trimmed when exceeding size limit
// =============================================================================

const PROJECT_ROOT = import.meta.dirname;
const LOG_DIR = path.join(PROJECT_ROOT, ".manus-logs");
const MAX_LOG_SIZE_BYTES = 1 * 1024 * 1024; // 1MB per log file
const TRIM_TARGET_BYTES = Math.floor(MAX_LOG_SIZE_BYTES * 0.6); // Trim to 60% to avoid constant re-trimming

type LogSource = "browserConsole" | "networkRequests" | "sessionReplay";

function ensureLogDir() {
  if (!fs.existsSync(LOG_DIR)) {
    fs.mkdirSync(LOG_DIR, { recursive: true });
  }
}

function trimLogFile(logPath: string, maxSize: number) {
  try {
    if (!fs.existsSync(logPath) || fs.statSync(logPath).size <= maxSize) {
      return;
    }

    const lines = fs.readFileSync(logPath, "utf-8").split("\n");
    const keptLines: string[] = [];
    let keptBytes = 0;

    // Keep newest lines (from end) that fit within 60% of maxSize
    const targetSize = TRIM_TARGET_BYTES;
    for (let i = lines.length - 1; i >= 0; i--) {
      const lineBytes = Buffer.byteLength(`${lines[i]}\n`, "utf-8");
      if (keptBytes + lineBytes > targetSize) break;
      keptLines.unshift(lines[i]);
      keptBytes += lineBytes;
    }

    fs.writeFileSync(logPath, keptLines.join("\n"), "utf-8");
  } catch {
    /* ignore trim errors */
  }
}

function writeToLogFile(source: LogSource, entries: unknown[]) {
  if (entries.length === 0) return;

  ensureLogDir();
  const logPath = path.join(LOG_DIR, `${source}.log`);

  // Format entries with timestamps
  const lines = entries.map((entry) => {
    const ts = new Date().toISOString();
    return `[${ts}] ${JSON.stringify(entry)}`;
  });

  // Append to log file
  fs.appendFileSync(logPath, `${lines.join("\n")}\n`, "utf-8");

  // Trim if exceeds max size
  trimLogFile(logPath, MAX_LOG_SIZE_BYTES);
}

/**
 * Vite plugin to collect browser debug logs
 * - POST /__manus__/logs: Browser sends logs, written directly to files
 * - Files: browserConsole.log, networkRequests.log, sessionReplay.log
 * - Auto-trimmed when exceeding 1MB (keeps newest entries)
 */
function vitePluginManusDebugCollector(): Plugin {
  return {
    name: "manus-debug-collector",

    transformIndexHtml(html) {
      if (process.env.NODE_ENV === "production") {
        return html;
      }
      return {
        html,
        tags: [
          {
            tag: "script",
            attrs: {
              src: "/__manus__/debug-collector.js",
              defer: true,
            },
            injectTo: "head",
          },
        ],
      };
    },

    configureServer(server: ViteDevServer) {
      // POST /__manus__/logs: Browser sends logs (written directly to files)
      server.middlewares.use("/__manus__/logs", (req, res, next) => {
        if (req.method !== "POST") {
          return next();
        }

        const handlePayload = (payload: any) => {
          // Write logs directly to files
          if (payload.consoleLogs?.length > 0) {
            writeToLogFile("browserConsole", payload.consoleLogs);
          }
          if (payload.networkRequests?.length > 0) {
            writeToLogFile("networkRequests", payload.networkRequests);
          }
          if (payload.sessionEvents?.length > 0) {
            writeToLogFile("sessionReplay", payload.sessionEvents);
          }

          res.writeHead(200, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ success: true }));
        };

        const reqBody = (req as { body?: unknown }).body;
        if (reqBody && typeof reqBody === "object") {
          try {
            handlePayload(reqBody);
          } catch (e) {
            res.writeHead(400, { "Content-Type": "application/json" });
            res.end(JSON.stringify({ success: false, error: String(e) }));
          }
          return;
        }

        let body = "";
        req.on("data", (chunk) => {
          body += chunk.toString();
        });

        req.on("end", () => {
          try {
            const payload = JSON.parse(body);
            handlePayload(payload);
          } catch (e) {
            res.writeHead(400, { "Content-Type": "application/json" });
            res.end(JSON.stringify({ success: false, error: String(e) }));
          }
        });
      });
    },
  };
}

const MONSTERS_FILE_PATH = path.resolve(PROJECT_ROOT, "client", "src", "data", "monsters.json");
const UPDATES_FILE_PATH = path.resolve(PROJECT_ROOT, "client", "src", "data", "updates.json");
const FEEDBACKS_FILE_PATH = path.resolve(PROJECT_ROOT, "client", "src", "data", "feedbacks.json");
const MAX_OPTIMIZED_IMAGE_BYTES = 2 * 1024 * 1024;

function readUpdatesFile() {
  try {
    if (!fs.existsSync(UPDATES_FILE_PATH)) return [];
    const value = JSON.parse(fs.readFileSync(UPDATES_FILE_PATH, "utf-8"));
    return Array.isArray(value) ? value : [];
  } catch (error) {
    console.error("Failed to read updates file:", error);
    return [];
  }
}

type UpdateSubscriber = { write: (chunk: string) => void };
const updateSubscribers = new Set<UpdateSubscriber>();
const monsterSubscribers = new Set<UpdateSubscriber>();

function broadcastUpdates(updates: unknown[]) {
  const payload = `event: updates\nid: ${Date.now()}\ndata: ${JSON.stringify(updates)}\n\n`;
  updateSubscribers.forEach((subscriber) => {
    try {
      subscriber.write(payload);
    } catch {
      updateSubscribers.delete(subscriber);
    }
  });
}

function saveUpdatesFile(updates: unknown[]) {
  fs.writeFileSync(UPDATES_FILE_PATH, JSON.stringify(updates, null, 2), "utf-8");
  broadcastUpdates(updates);
}

function broadcastMonsters(monsters: unknown[]) {
  const payload = `event: monsters\nid: ${Date.now()}\ndata: ${JSON.stringify(monsters)}\n\n`;
  monsterSubscribers.forEach((subscriber) => {
    try {
      subscriber.write(payload);
    } catch {
      monsterSubscribers.delete(subscriber);
    }
  });
}

function readFeedbacksFile() {
  try {
    if (!fs.existsSync(FEEDBACKS_FILE_PATH)) return [];
    const value = JSON.parse(fs.readFileSync(FEEDBACKS_FILE_PATH, "utf-8"));
    return Array.isArray(value) ? value : [];
  } catch (error) {
    console.error("Failed to read feedbacks file:", error);
    return [];
  }
}

const feedbackSubscribers = new Set<UpdateSubscriber>();

function broadcastFeedbacks(feedbacks: unknown[]) {
  const payload = `event: feedbacks\nid: ${Date.now()}\ndata: ${JSON.stringify(feedbacks)}\n\n`;
  feedbackSubscribers.forEach((subscriber) => {
    try {
      subscriber.write(payload);
    } catch {
      feedbackSubscribers.delete(subscriber);
    }
  });
}

function saveFeedbacksFile(feedbacks: unknown[]) {
  fs.writeFileSync(FEEDBACKS_FILE_PATH, JSON.stringify(feedbacks, null, 2), "utf-8");
  broadcastFeedbacks(feedbacks);
}

function readMonstersFile() {
  try {
    if (!fs.existsSync(MONSTERS_FILE_PATH)) return [];
    return JSON.parse(fs.readFileSync(MONSTERS_FILE_PATH, "utf-8"));
  } catch (error) {
    console.error("Failed to read monsters file:", error);
    return [];
  }
}

function vitePluginMonstersApi(): Plugin {
  return {
    name: "mixmaster-monsters-api",
    configureServer(server: ViteDevServer) {
      server.middlewares.use("/api/monster-image", (req, res, next) => {
        if (req.method === "GET") {
          const key = new URL(req.url || "/", "http://localhost").searchParams.get("key") || "";
          if (!key) {
            res.writeHead(400, { "Content-Type": "application/json" });
            res.end(JSON.stringify({ error: "Invalid image key" }));
            return;
          }
          void loadMonsterData(MONSTERS_FILE_PATH).then((monsters) => readProtectedMonsterImage(monsters, key)).then((image) => {
            if (!image) {
              res.writeHead(404, { "Content-Type": "application/json" });
              res.end(JSON.stringify({ error: "Image not found" }));
              return;
            }
            res.writeHead(200, {
              ...PROTECTED_MONSTER_IMAGE_HEADERS,
              "Content-Type": image.contentType,
              "Content-Length": String(image.bytes.length),
            });
            res.end(image.bytes);
          }).catch((error) => {
            console.error("Failed to read protected image:", error);
            res.writeHead(502, { "Content-Type": "application/json" });
            res.end(JSON.stringify({ error: "Image unavailable" }));
          });
          return;
        }
        if (req.method !== "POST") {
          next();
          return;
        }
        let body = "";
        req.setEncoding("utf8");
        req.on("data", (chunk) => {
          body += chunk;
          if (body.length > 50 * 1024 * 1024) req.destroy();
        });
        req.on("end", async () => {
          try {
            const { monsterId, fileName, contentType, data } = JSON.parse(body || "{}");
            if (!monsterId || !fileName || !contentType || typeof data !== "string") {
              res.writeHead(400, { "Content-Type": "application/json" });
              res.end(JSON.stringify({ error: "Invalid image payload" }));
              return;
            }
            if (contentType !== "image/webp" || !data.startsWith("data:image/webp;base64,")) {
              res.writeHead(400, { "Content-Type": "application/json" });
              res.end(JSON.stringify({ error: "Optimized WebP image payload required" }));
              return;
            }
            const base64 = data.replace(/^data:image\/webp;base64,/, "");
            const buffer = Buffer.from(base64, "base64");
            if (buffer.length === 0 || buffer.length > MAX_OPTIMIZED_IMAGE_BYTES) {
              res.writeHead(400, { "Content-Type": "application/json" });
              res.end(JSON.stringify({ error: "Optimized image must be between 1 byte and 2MB" }));
              return;
            }
            const current = await loadMonsterData(MONSTERS_FILE_PATH);
            const monsterIndex = current.findIndex((monster) => String(monster.id || "") === String(monsterId));
            if (monsterIndex < 0) {
              res.writeHead(404, { "Content-Type": "application/json" });
              res.end(JSON.stringify({ error: "Monster not found" }));
              return;
            }
            const result = await storagePut(`monster-images/${monsterId}.webp`, buffer, "image/webp");
            const updatedMonsters = current.map((monster, index) => index === monsterIndex ? { ...monster, imageUrl: result.url } : monster);
            await saveMonsterData(updatedMonsters, MONSTERS_FILE_PATH);
            broadcastMonsters(updatedMonsters);
            res.writeHead(200, { "Content-Type": "application/json" });
            res.end(JSON.stringify({ ...result, persisted: true }));
          } catch (error) {
            console.error("Failed to upload monster image:", error);
            res.writeHead(500, { "Content-Type": "application/json" });
            res.end(JSON.stringify({ error: "Failed to upload monster image" }));
          }
        });
      });

      server.middlewares.use("/api/updates", (req, res, next) => {
        if (req.method === "GET" && req.url === "/events") {
          res.writeHead(200, {
            "Content-Type": "text/event-stream; charset=utf-8",
            "Cache-Control": "no-cache, no-store, must-revalidate",
            Connection: "keep-alive",
            "X-Accel-Buffering": "no",
          });
          updateSubscribers.add(res);
          res.write(`event: updates\ndata: ${JSON.stringify(readUpdatesFile())}\n\n`);
          const heartbeat = setInterval(() => res.write(": heartbeat\n\n"), 25_000);
          req.on("close", () => {
            clearInterval(heartbeat);
            updateSubscribers.delete(res);
          });
          return;
        }

        if (req.method === "GET") {
          res.writeHead(200, { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" });
          res.end(JSON.stringify(readUpdatesFile()));
          return;
        }

        if (req.method !== "POST") {
          next();
          return;
        }

        let body = "";
        req.setEncoding("utf8");
        req.on("data", (chunk) => {
          body += chunk;
          if (body.length > 10 * 1024 * 1024) req.destroy();
        });
        req.on("end", () => {
          try {
            const payload = JSON.parse(body);
            let updates: unknown[];
            if (req.url === "/append") {
              if (!payload || typeof payload !== "object" || !payload.id || !payload.title) {
                res.writeHead(400, { "Content-Type": "application/json" });
                res.end(JSON.stringify({ error: "Invalid update item" }));
                return;
              }
              const byId = new Map(readUpdatesFile().map((item: any) => [String(item.id), item]));
              byId.set(String(payload.id), payload);
              updates = Array.from(byId.values()).sort((a: any, b: any) => {
                const aDate = Date.parse(String(a.date || "")) || 0;
                const bDate = Date.parse(String(b.date || "")) || 0;
                return bDate - aDate;
              });
            } else {
              if (!Array.isArray(payload)) {
                res.writeHead(400, { "Content-Type": "application/json" });
                res.end(JSON.stringify({ error: "Invalid update data" }));
                return;
              }
              updates = payload;
            }
            saveUpdatesFile(updates);
            res.writeHead(200, { "Content-Type": "application/json" });
            res.end(JSON.stringify({ success: true, updates }));
          } catch (error) {
            console.error("Failed to save updates file:", error);
            res.writeHead(400, { "Content-Type": "application/json" });
            res.end(JSON.stringify({ error: "Invalid JSON payload" }));
          }
        });
      });

      server.middlewares.use("/api/feedbacks", (req, res, next) => {
        if (req.method === "GET" && req.url === "/events") {
          res.writeHead(200, {
            "Content-Type": "text/event-stream; charset=utf-8",
            "Cache-Control": "no-cache, no-store, must-revalidate",
            Connection: "keep-alive",
            "X-Accel-Buffering": "no",
          });
          feedbackSubscribers.add(res);
          res.write(`event: feedbacks\ndata: ${JSON.stringify(readFeedbacksFile())}\n\n`);
          const heartbeat = setInterval(() => res.write(": heartbeat\n\n"), 25_000);
          req.on("close", () => {
            clearInterval(heartbeat);
            feedbackSubscribers.delete(res);
          });
          return;
        }

        if (req.method === "GET") {
          res.writeHead(200, { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" });
          res.end(JSON.stringify(readFeedbacksFile()));
          return;
        }

        if (req.method !== "POST" && req.method !== "PATCH") {
          next();
          return;
        }

        let body = "";
        req.setEncoding("utf8");
        req.on("data", (chunk) => {
          body += chunk;
          if (body.length > 2 * 1024 * 1024) req.destroy();
        });
        req.on("end", () => {
          try {
            const payload = JSON.parse(body || "{}");
            if (req.method === "POST") {
              if (!payload || typeof payload !== "object" || !payload.id || !payload.title || !payload.content) {
                res.writeHead(400, { "Content-Type": "application/json" });
                res.end(JSON.stringify({ error: "Invalid feedback item" }));
                return;
              }
              const feedbacks = [payload, ...readFeedbacksFile().filter((item: any) => String(item.id) !== String(payload.id))];
              saveFeedbacksFile(feedbacks);
              res.writeHead(201, { "Content-Type": "application/json" });
              res.end(JSON.stringify({ success: true, feedbacks }));
              return;
            }

            const status = payload.status;
            if (status !== "pending" && status !== "reviewing" && status !== "completed") {
              res.writeHead(400, { "Content-Type": "application/json" });
              res.end(JSON.stringify({ error: "Invalid feedback status" }));
              return;
            }
            const feedbackId = req.url?.replace(/^\//, "");
            let found = false;
            const feedbacks = readFeedbacksFile().map((item: any) => {
              if (String(item.id) !== feedbackId) return item;
              found = true;
              return { ...item, status };
            });
            if (!found) {
              res.writeHead(404, { "Content-Type": "application/json" });
              res.end(JSON.stringify({ error: "Feedback not found" }));
              return;
            }
            saveFeedbacksFile(feedbacks);
            res.writeHead(200, { "Content-Type": "application/json" });
            res.end(JSON.stringify({ success: true, feedbacks }));
          } catch (error) {
            console.error("Failed to save feedback:", error);
            res.writeHead(400, { "Content-Type": "application/json" });
            res.end(JSON.stringify({ error: "Invalid JSON payload" }));
          }
        });
      });

      server.middlewares.use("/api/monsters", async (req, res, next) => {
        if (req.method === "GET" && req.url === "/events") {
          res.writeHead(200, {
            "Content-Type": "text/event-stream; charset=utf-8",
            "Cache-Control": "no-cache, no-store, must-revalidate",
            Connection: "keep-alive",
            "X-Accel-Buffering": "no",
          });
          monsterSubscribers.add(res);
          const monsters = await loadMonsterData(MONSTERS_FILE_PATH);
          res.write(`event: monsters\ndata: ${JSON.stringify(monsters)}\n\n`);
          const heartbeat = setInterval(() => res.write(": heartbeat\n\n"), 25_000);
          req.on("close", () => {
            clearInterval(heartbeat);
            monsterSubscribers.delete(res);
          });
          return;
        }

        if (req.method === "GET") {
          const monsters = await loadMonsterData(MONSTERS_FILE_PATH);
          const raw = JSON.stringify(monsters);
          const etag = `"${createHash("sha1").update(raw).digest("hex")}"`;
          if (req.headers["if-none-match"] === etag) {
            res.writeHead(304);
            res.end();
            return;
          }
          res.writeHead(200, { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store", ETag: etag });
          res.end(raw);
          return;
        }

        if (req.method !== "POST") {
          next();
          return;
        }

        let body = "";
        req.setEncoding("utf8");
        req.on("data", (chunk) => {
          body += chunk;
          if (body.length > 50 * 1024 * 1024) req.destroy();
        });
        req.on("end", async () => {
          try {
            const incoming = JSON.parse(body);
            if (!Array.isArray(incoming)) {
              res.writeHead(400, { "Content-Type": "application/json" });
              res.end(JSON.stringify({ error: "Invalid monster data" }));
              return;
            }
            const current = await loadMonsterData(MONSTERS_FILE_PATH);
            const monsters = mergeMonsterMetadata(incoming as Record<string, unknown>[], current);
            await saveMonsterData(monsters, MONSTERS_FILE_PATH);
            broadcastMonsters(monsters);
            res.writeHead(200, { "Content-Type": "application/json" });
            res.end(JSON.stringify({ success: true, monsters }));
          } catch (error) {
            console.error("Failed to save monsters:", error);
            res.writeHead(400, { "Content-Type": "application/json" });
            res.end(JSON.stringify({ error: "Invalid monster JSON payload" }));
          }
        });
      });
    },
  };
}

function vitePluginStorageProxy(): Plugin {
  return {
    name: "manus-storage-proxy",
    configureServer(server: ViteDevServer) {
      server.middlewares.use("/manus-storage", async (req, res) => {
        const key = req.url?.replace(/^\//, "");
        if (!key) {
          res.writeHead(400, { "Content-Type": "text/plain" });
          res.end("Missing storage key");
          return;
        }
        if (key.startsWith("monster-images/")) {
          res.writeHead(404, { "Content-Type": "text/plain", "Cache-Control": "no-store" });
          res.end("Protected monster images must use the approved-member proxy");
          return;
        }

        const forgeBaseUrl = (process.env.BUILT_IN_FORGE_API_URL || "").replace(/\/+$/, "");
        const forgeKey = process.env.BUILT_IN_FORGE_API_KEY;

        if (!forgeBaseUrl || !forgeKey) {
          res.writeHead(500, { "Content-Type": "text/plain" });
          res.end("Storage proxy not configured");
          return;
        }

        try {
          const forgeUrl = new URL("v1/storage/presign/get", forgeBaseUrl + "/");
          forgeUrl.searchParams.set("path", key);

          const forgeResp = await fetch(forgeUrl, {
            headers: { Authorization: `Bearer ${forgeKey}` },
          });

          if (!forgeResp.ok) {
            res.writeHead(502, { "Content-Type": "text/plain" });
            res.end("Storage backend error");
            return;
          }

          const { url } = (await forgeResp.json()) as { url: string };
          if (!url) {
            res.writeHead(502, { "Content-Type": "text/plain" });
            res.end("Empty signed URL");
            return;
          }

          res.writeHead(307, {
            Location: url,
            "Cache-Control": "no-store, no-cache, must-revalidate, private",
            Pragma: "no-cache",
            "Referrer-Policy": "no-referrer",
            "Cross-Origin-Resource-Policy": "same-origin",
            "X-Content-Type-Options": "nosniff",
          });
          res.end();
        } catch {
          res.writeHead(502, { "Content-Type": "text/plain" });
          res.end("Storage proxy error");
        }
      });
    },
  };
}

const plugins = [react(), tailwindcss(), jsxLocPlugin(), vitePluginManusRuntime(), vitePluginManusDebugCollector(), vitePluginMemberAuth(), vitePluginMarketplaceApi(MONSTERS_FILE_PATH), vitePluginMonstersApi(), vitePluginStorageProxy()];

export default defineConfig({
  plugins,
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "client", "src"),
      "@shared": path.resolve(import.meta.dirname, "shared"),
      "@assets": path.resolve(import.meta.dirname, "attached_assets"),
    },
  },
  envDir: path.resolve(import.meta.dirname),
  root: path.resolve(import.meta.dirname, "client"),
  build: {
    outDir: path.resolve(import.meta.dirname, "dist/public"),
    emptyOutDir: true,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes("node_modules")) return;
          if (id.includes("lucide-react")) return "icons";
          if (id.includes("@radix-ui")) return "radix-ui";
          if (id.includes("framer-motion")) return "motion";
          if (id.includes("/react/") || id.includes("react-dom") || id.includes("scheduler") || id.includes("wouter")) return "react-router";
        },
      },
    },
  },
  server: {
    port: 3000,
    strictPort: false, // Will find next available port if 3000 is busy
    host: true,
    allowedHosts: [
      ".manuspre.computer",
      ".manus.computer",
      ".manus-asia.computer",
      ".manuscomputer.ai",
      ".manusvm.computer",
      "localhost",
      "127.0.0.1",
    ],
    fs: {
      strict: true,
      deny: ["**/.*"],
    },
  },
});
