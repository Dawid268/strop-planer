import * as fs from 'fs';
import * as path from 'path';

/** Log file names for external tools (under logs/) */
export const TOOL_LOG_FILES = {
  python: 'python.log',
  inkscape: 'inkscape.log',
} as const;

export type ToolLogFile = keyof typeof TOOL_LOG_FILES;

/**
 * Resolves logs directory: always optimizer/logs/ (relative to app root).
 * Uses __dirname so it works regardless of process.cwd().
 * Compiled: dist/common/utils/tool-logger.util.js -> app root = ../../..
 */
function getLogDir(): string {
  const appRoot = path.resolve(__dirname, '..', '..', '..');
  const logDir = path.join(appRoot, 'logs');
  fs.mkdirSync(logDir, { recursive: true });
  return logDir;
}

let toolLogWriteErrorLogged = false;

/**
 * Ensures the tool log file exists (creates it with a header line if missing).
 * Call at the start of a phase so the file is visible even before any output is captured.
 */
export function ensureToolLogFile(fileKey: ToolLogFile): void {
  try {
    const logDir = getLogDir();
    const fileName = TOOL_LOG_FILES[fileKey];
    const filePath = path.resolve(logDir, fileName);
    if (!fs.existsSync(filePath)) {
      const timestamp = new Date().toISOString();
      const header = `[${timestamp}] [init] ${fileKey} log started\n---\n`;
      fs.writeFileSync(filePath, header, 'utf8');
    }
  } catch (err) {
    if (!toolLogWriteErrorLogged) {
      toolLogWriteErrorLogged = true;
      const msg = err instanceof Error ? err.message : String(err);
      process.stderr.write(
        `[tool-logger] Failed to create log file (${fileKey}): ${msg}\n`,
      );
    }
  }
}

/**
 * Appends a line to a dedicated tool log file (e.g. python.log, inkscape.log).
 * Used for stdout/stderr from Python script and Inkscape so they go to a concrete file.
 */
export function appendToToolLog(
  fileKey: ToolLogFile,
  label: string,
  content: string,
): void {
  if (!content.trim()) return;
  try {
    const logDir = getLogDir();
    const fileName = TOOL_LOG_FILES[fileKey];
    const filePath = path.resolve(logDir, fileName);
    const timestamp = new Date().toISOString();
    const line = `[${timestamp}] [${label}]\n${content.trim()}\n---\n`;
    fs.appendFileSync(filePath, line, 'utf8');
  } catch (err) {
    if (!toolLogWriteErrorLogged) {
      toolLogWriteErrorLogged = true;
      const msg = err instanceof Error ? err.message : String(err);
      process.stderr.write(
        `[tool-logger] Failed to write to logs (${fileKey}): ${msg}\n`,
      );
    }
  }
}
