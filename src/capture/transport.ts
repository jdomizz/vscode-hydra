import * as http from 'node:http';
import * as fs from 'node:fs';
import * as path from 'node:path';
import type { AddressInfo } from 'node:net';

/**
 * Editor-side HTTP receiver for capture blobs.
 *
 * The runtime POSTs PNG/MP4 blobs to this server after a `capture:image`
 * or `capture:stop` command. The server writes the blob to disk and
 * resolves a pending promise with the file path.
 *
 * Transport model (per D3 γ correction): control commands travel on the
 * JSON wire; bulk data (PNG/MP4 blobs) travels out-of-band via HTTP POST.
 * This is the EDITOR's side of the bulk-data path.
 */
export class BlobReceiver {
    #server: http.Server | null = null;
    #captureDir: string;
    #pending: Map<string, PendingCapture> = new Map();

    /**
     * @param captureDir — directory where blobs are written. Typically
     * `<workspaceFolder>/.vscode-hydra/captures/`.
     */
    constructor(captureDir: string) {
        this.#captureDir = captureDir;
    }

    /**
     * Start listening on the given port.
     *
     * Creates the capture directory if it does not exist. Resolves when
     * the server is listening.
     */
    async start(port: number): Promise<void> {
        if (this.#server) {
            throw new Error('BlobReceiver: already started');
        }
        await fs.promises.mkdir(this.#captureDir, { recursive: true });
        return new Promise((resolve, reject) => {
            const server = http.createServer((req, res) => this.#handleRequest(req, res));
            server.on('error', reject);
            server.listen(port, '127.0.0.1', () => {
                this.#server = server;
                resolve();
            });
        });
    }

    /**
     * Stop listening and release the port.
     */
    async stop(): Promise<void> {
        if (!this.#server) { return; }
        return new Promise((resolve) => {
            this.#server!.close(() => {
                this.#server = null;
                resolve();
            });
        });
    }

    /**
     * The port the server is listening on, or null if not started.
     */
    get port(): number | null {
        if (!this.#server) { return null; }
        const addr = this.#server.address() as AddressInfo | null;
        return addr?.port ?? null;
    }

    /**
     * Register a pending capture.
     *
     * The runtime POSTs the blob with a `captureId` query param; the
     * server resolves the pending promise with the file path.
     *
     * @param captureId — unique identifier for this capture (e.g. timestamp)
     * @param ext — file extension (e.g. `.png`, `.webm`)
     * @returns promise that resolves with the file path when the blob arrives
     */
    expectBlob(captureId: string, ext: string): Promise<string> {
        return new Promise((resolve, reject) => {
            this.#pending.set(captureId, { resolve, reject, ext });
        });
    }

    async #handleRequest(req: http.IncomingMessage, res: http.ServerResponse): Promise<void> {
        if (req.method !== 'POST') {
            res.writeHead(405, { 'Content-Type': 'text/plain' });
            res.end('Method Not Allowed');
            return;
        }

        const url = new URL(req.url ?? '/', 'http://localhost');
        const captureId = url.searchParams.get('captureId');
        if (!captureId) {
            res.writeHead(400, { 'Content-Type': 'text/plain' });
            res.end('Missing captureId');
            return;
        }

        const pending = this.#pending.get(captureId);
        if (!pending) {
            res.writeHead(404, { 'Content-Type': 'text/plain' });
            res.end('Unknown captureId');
            return;
        }

        const chunks: Buffer[] = [];
        req.on('data', (chunk: Buffer) => chunks.push(chunk));
        req.on('end', async () => {
            const blob = Buffer.concat(chunks);
            const filename = `${captureId}${pending.ext}`;
            const filepath = path.join(this.#captureDir, filename);
            try {
                await fs.promises.writeFile(filepath, blob);
                this.#pending.delete(captureId);
                pending.resolve(filepath);
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ ok: true, path: filepath }));
            } catch (err) {
                this.#pending.delete(captureId);
                pending.reject(err instanceof Error ? err : new Error('Write failed'));
                res.writeHead(500, { 'Content-Type': 'text/plain' });
                res.end('Write failed');
            }
        });
        req.on('error', (err: unknown) => {
            this.#pending.delete(captureId);
            pending.reject(err instanceof Error ? err : new Error('Request error'));
        });
    }
}

interface PendingCapture {
    resolve: (path: string) => void;
    reject: (err: Error) => void;
    ext: string;
}
