import { describe, expect, it } from "vitest";
import { claudeProjectDir, lastClaudeReply, lastClaudeSessionCommand } from "../src/agents/claudeReply.ts";

const line = (o: object) => JSON.stringify(o);
const user = (content: unknown) => line({ type: "user", message: { role: "user", content } });
const assistant = (...content: object[]) => line({ type: "assistant", message: { role: "assistant", content } });
const text = (t: string) => ({ type: "text", text: t });
const tool = { type: "tool_use", id: "t", name: "Bash", input: {} };
const result = user([{ type: "tool_result", tool_use_id: "t", content: "ok" }]);

describe("lastClaudeReply", () => {
  it("returns the report after the last tool call, without thinking or narration", () => {
    const jsonl = [
      user("fix it"),
      assistant({ type: "thinking", thinking: "hmm" }),
      assistant(text("Let me look."), tool),
      result,
      assistant({ type: "thinking", thinking: "done" }),
      assistant(text("## Report\n\nFixed.")),
      assistant(text("Tests pass.")),
      line({ type: "ai-title", title: "x" }),
      "",
    ].join("\n");
    expect(lastClaudeReply(jsonl)).toBe("## Report\n\nFixed.\n\nTests pass.");
  });

  it("stops at the prompt the reply answered", () => {
    expect(lastClaudeReply([assistant(text("old")), user("hi"), assistant(text("new"))].join("\n"))).toBe("new");
  });

  it("gives the previous reply while a new prompt waits", () => {
    expect(lastClaudeReply([user("a"), assistant(text("answer")), user("next")].join("\n"))).toBe("answer");
  });

  it("skips sidechains, meta entries and a line cut by the tail", () => {
    const jsonl = ['e":1}', user("a"), assistant(text("main")), line({ type: "assistant", isSidechain: true, message: { content: [text("sub")] } })].join("\n");
    expect(lastClaudeReply(jsonl)).toBe("main");
  });

  it("is null with no reply", () => {
    expect(lastClaudeReply("")).toBeNull();
    expect(lastClaudeReply([user("a"), assistant(tool)].join("\n"))).toBeNull();
  });
});

describe("claudeProjectDir", () => {
  it("matches Claude Code's folder names", () => {
    expect(claudeProjectDir("/home/adi/Project")).toBe("-home-adi-Project");
    expect(claudeProjectDir("/home/a.b/my_app")).toBe("-home-a-b-my-app");
  });
});

describe("lastClaudeSessionCommand", () => {
  it("quotes the folder and has no backslashes", () => {
    expect(lastClaudeSessionCommand("/x/it's")).toContain("-x-it-s");
    expect(lastClaudeSessionCommand("/x")).not.toContain("\\");
  });
});
