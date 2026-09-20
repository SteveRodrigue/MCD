import { spawn } from 'node:child_process';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';

const MAX_LOG_FILES = 10;
const logDirectory = path.resolve(process.cwd(), 'logs', 'dev-server');

function createLogFilePath(): string {
  fs.mkdirSync(logDirectory, { recursive: true });

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  return path.join(logDirectory, `dev-${timestamp}.log`);
}

function pruneOldLogs(): void {
  const logFiles = fs
    .readdirSync(logDirectory)
    .filter((file) => file.startsWith('dev-') && file.endsWith('.log'))
    .map((file) => ({
      path: path.join(logDirectory, file),
      modifiedAt: fs.statSync(path.join(logDirectory, file)).mtimeMs,
    }))
    .sort((left, right) => right.modifiedAt - left.modifiedAt);

  for (const logFile of logFiles.slice(MAX_LOG_FILES - 1)) {
    fs.unlinkSync(logFile.path);
  }
}

function resolveViteExecutable(): string {
  const require = createRequire(import.meta.url);
  const viteEntryPoint = require.resolve('vite');
  return path.resolve(path.dirname(viteEntryPoint), '..', '..', 'bin', 'vite.js');
}

function writeOutput(
  destination: NodeJS.WriteStream,
  logStream: fs.WriteStream,
  output: string | Buffer,
): void {
  destination.write(output);
  logStream.write(output);
}

const logFilePath = createLogFilePath();
pruneOldLogs();

const logStream = fs.createWriteStream(logFilePath, { flags: 'a' });
const relativeLogPath = path.relative(process.cwd(), logFilePath);
const logLocation = `[dev-server] Logging output to ${relativeLogPath}\n`;
writeOutput(process.stdout, logStream, logLocation);

const vite = spawn(process.execPath, [resolveViteExecutable(), ...process.argv.slice(2)], {
  cwd: process.cwd(),
  env: process.env,
  stdio: ['inherit', 'pipe', 'pipe'],
});

vite.stdout.on('data', (output: Buffer) => writeOutput(process.stdout, logStream, output));
vite.stderr.on('data', (output: Buffer) => writeOutput(process.stderr, logStream, output));

let completed = false;
function finish(exitCode: number): void {
  if (completed) return;
  completed = true;
  logStream.end(() => {
    process.exitCode = exitCode;
  });
}

vite.on('error', (error) => {
  writeOutput(process.stderr, logStream, `[dev-server] Failed to start Vite: ${error.message}\n`);
  finish(1);
});

vite.on('close', (exitCode) => finish(exitCode ?? 1));

for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.on(signal, () => {
    if (!vite.killed) vite.kill(signal);
  });
}
