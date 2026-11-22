import { posix, quote } from "../host/shell.ts";

/** Bytes read off the end of a session file: enough for the last reply, small enough for a phone. */
const TAIL_BYTES = 4_000_000;

/** Claude Code's folder for a project under `projects/`: every character but letters and digits becomes `-`. */
export const claudeProjectDir = (cwd: string): string => cwd.replace(/[^a-zA-Z0-9]/g, "-");

/**
 * A command that prints the end of the newest Claude Code session file for `cwd`, looking in
 * `$CLAUDE_CONFIG_DIR` and every `~/.claude*` folder (people keep several configs).
 */
export function lastClaudeSessionCommand(cwd: string): string {
  const dir = quote(claudeProjectDir(cwd));
  return posix(
    `f=$(ls -t "$CLAUDE_CONFIG_DIR"/projects/${dir}/*.jsonl "$HOME"/.claude*/projects/${dir}/*.jsonl 2>/dev/null | head -n 1); ` +
      `[ -n "$f" ] || exit 3; tail -c ${TAIL_BYTES} "$f"`,
  );
}

type Block = { type?: string; text?: string };

/**
 * The text of Claude Code's last finished reply in a session file (or its tail): the text blocks
 * after its last tool call, without thinking. Null when there is none.
 */
export function lastClaudeReply(jsonl: string): string | null {
  const parts: string[] = [];
  const lines = jsonl.split("\n");
  for (let i = lines.length - 1; i >= 0; i--) {
    let entry: { type?: string; isSidechain?: boolean; isMeta?: boolean; message?: { content?: unknown } };
    try {
      entry = JSON.parse(lines[i]);
    } catch {
      continue; // a line cut by the tail, or one being written
    }
    if ((entry.type !== "assistant" && entry.type !== "user") || entry.isSidechain || entry.isMeta) continue;
    const content = entry.message?.content;
    const blocks: Block[] = typeof content === "string" ? [{ type: "text", text: content }] : Array.isArray(content) ? content : [];
    if (entry.type === "user") {
      if (parts.length > 0) break; // the prompt the reply answered
      continue;
    }
    let stop = false;
    for (let b = blocks.length - 1; b >= 0; b--) {
      const block = blocks[b];
      if (block.type === "text" && block.text?.trim()) parts.push(block.text.trim());
      else if (block.type === "tool_use" && parts.length > 0) stop = true;
    }
    if (stop) break;
  }
  return parts.length > 0 ? parts.reverse().join("\n\n") : null;
}
