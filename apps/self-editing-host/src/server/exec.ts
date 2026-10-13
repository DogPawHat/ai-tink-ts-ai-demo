import { SpriteCommand, SpritesClient } from "@fly/sprites";

export interface RunOptions {
  cwd?: string;
  env?: Record<string, string>;
  /** Written to the command's stdin, then stdin is closed. */
  input?: string | Buffer;
  timeoutMs?: number;
  signal?: AbortSignal;
}

export interface RunResult {
  stdout: string;
  stderr: string;
  exitCode: number;
}

/**
 * Runs a shell script on a Sprite. `@fly/sprites` resolves when the process
 * exits; the TanStack Sprites provider waits ~11 s for the socket to close.
 */
export async function runOnSprite(
  client: SpritesClient,
  spriteName: string,
  script: string,
  options: RunOptions = {},
): Promise<RunResult> {
  const command = new SpriteCommand(client.sprite(spriteName), "bash", ["-c", script], {
    ...(options.cwd ? { cwd: options.cwd } : {}),
    ...(options.env ? { env: options.env } : {}),
  });
  command.stdout.setEncoding("utf8");
  command.stderr.setEncoding("utf8");
  let stdout = "";
  let stderr = "";
  command.stdout.on("data", (chunk: string) => (stdout += chunk));
  command.stderr.on("data", (chunk: string) => (stderr += chunk));
  // An exec error (e.g. a dropped socket) must not crash the process.
  let failure: unknown;
  command.on("error", (error) => (failure = error));

  const stop = () => command.kill("SIGTERM");
  options.signal?.addEventListener("abort", stop, { once: true });
  const timer = options.timeoutMs ? setTimeout(stop, options.timeoutMs) : undefined;
  try {
    await command.start();
    if (options.input !== undefined) {
      await new Promise<void>((resolve, reject) =>
        command.stdin.write(options.input, (error) => (error ? reject(error) : resolve())),
      );
    }
    await new Promise<void>((resolve) => command.stdin.end(resolve));
    const exitCode = await command.wait();
    if (failure && exitCode !== 0) throw failure;
    return { stdout, stderr, exitCode };
  } finally {
    if (timer) clearTimeout(timer);
    options.signal?.removeEventListener("abort", stop);
  }
}
