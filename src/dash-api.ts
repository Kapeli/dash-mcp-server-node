import { execSync } from "child_process";
import { readFileSync } from "fs";
import { homedir } from "os";
import { join } from "path";

type LogFn = (level: "debug" | "info" | "warning" | "error", message: string) => void;

export async function checkApiHealth(port: number, log: LogFn): Promise<boolean> {
    const baseUrl = `http://127.0.0.1:${port}`;
    try {
        const response = await fetch(`${baseUrl}/health`, {
            signal: AbortSignal.timeout(5000),
        });
        if(!response.ok) {
            log("debug", `Health check failed for ${baseUrl}: HTTP ${response.status}`);
            return false;
        }
        log("debug", `Successfully connected to Dash API at ${baseUrl}`);
        return true;
    }
    catch(e) {
        log("debug", `Health check failed for ${baseUrl}: ${e}`);
        return false;
    }
}

export function checkDashRunning(): boolean {
    try {
        const result = execSync("pgrep -f Dash", { timeout: 5000, stdio: "pipe" });
        return true;
    }
    catch {
        return false;
    }
}

export async function ensureDashRunning(log: LogFn): Promise<boolean> {
    if(checkDashRunning()) {
        return true;
    }

    log("info", "Dash is not running. Launching Dash...");
    try {
        try {
            execSync("open -g -j -b com.kapeli.dashdoc", { timeout: 10000 });
        }
        catch {
            execSync("open -g -j -b com.kapeli.dash-setapp", { timeout: 10000 });
        }

        // Wait for Dash to start
        await new Promise(resolve => setTimeout(resolve, 4000));

        if(!checkDashRunning()) {
            log("error", "Failed to launch Dash application");
            return false;
        }

        log("info", "Dash launched successfully");
        return true;
    }
    catch(e) {
        log("error", `Error launching Dash: ${e}`);
        return false;
    }
}

export async function getDashApiPort(log: LogFn): Promise<number | null> {
    const statusFile = join(
        homedir(),
        "Library",
        "Application Support",
        "Dash",
        ".dash_api_server",
        "status.json"
    );

    try {
        const data = JSON.parse(readFileSync(statusFile, "utf-8"));
        const port = data.port;
        if(port == null) {
            return null;
        }

        if(await checkApiHealth(port, log)) {
            return port;
        }
        return null;
    }
    catch {
        return null;
    }
}

export async function workingApiBaseUrl(log: LogFn): Promise<string | null> {
    const dashRunning = await ensureDashRunning(log);
    if(!dashRunning) {
        return null;
    }

    let port = await getDashApiPort(log);
    if(port != null) {
        return `http://127.0.0.1:${port}`;
    }

    // Try to automatically enable the Dash API Server
    log("info", "The Dash API Server is not enabled. Attempting to enable it automatically...");
    try {
        execSync('defaults write com.kapeli.dashdoc DHAPIServerEnabled YES', { timeout: 10000 });
        execSync('defaults write com.kapeli.dash-setapp DHAPIServerEnabled YES', { timeout: 10000 });

        // Wait for Dash to pick up the change
        await new Promise(resolve => setTimeout(resolve, 2000));

        port = await getDashApiPort(log);
        if(port != null) {
            log("info", "Successfully enabled Dash API Server");
            return `http://127.0.0.1:${port}`;
        }

        log("error", "Failed to enable Dash API Server automatically. Please enable it manually in Dash Settings > Integration");
        return null;
    }
    catch(e) {
        log("error", "Failed to enable Dash API Server automatically. Please enable it manually in Dash Settings > Integration");
        return null;
    }
}

export function estimateTokens(obj: unknown): number {
    if(typeof obj === "string") {
        return Math.max(1, Math.floor(obj.length / 4));
    }
    if(Array.isArray(obj)) {
        let total = 0;
        for(let i = 0; i < obj.length; ++i) {
            total += estimateTokens(obj[i]);
        }
        return total;
    }
    if(obj != null && typeof obj === "object") {
        let total = 0;
        for(const [k, v] of Object.entries(obj)) {
            total += estimateTokens(k) + estimateTokens(v);
        }
        return total;
    }
    return Math.max(1, Math.floor(String(obj).length / 4));
}
