// @vitest-environment node
import { describe, expect, it } from "vitest";
import { validateChatBody, validateDebriefBody } from "./validate-request";

const turn = { role: "user", rawInput: "你好" };
const session = { currentState: "start", slotsFilledMap: {}, turns: [turn], hintLevel: 0 };
const chat = { missionId: "m1", userInput: "你好", session };

describe("session input validation", () => {
  it.each([
    { role: "developer" },
    { errorTags: [{ toString: null, valueOf: null }] },
    { understood: "yes" },
    { detectedScript: {} },
    { hintUsed: -1 },
    { hintUsed: 5 },
    { hintUsed: 1.5 },
  ])("rejects invalid turn fields before either provider route: %j", (fields) => {
    const invalidSession = { ...session, turns: [{ ...turn, ...fields }] };
    expect(validateChatBody({ ...chat, session: invalidSession })).not.toBeNull();
    expect(validateDebriefBody({ missionId: "m1", session: invalidSession })).not.toBeNull();
  });

  it.each([-1, 5, 1.5])("rejects an invalid hint level: %s", (hintLevel) => {
    expect(validateChatBody({ ...chat, session: { ...session, hintLevel } })).not.toBeNull();
  });

  it.each([-1, 1.5])("rejects an invalid hint count: %s", (hintUsageCount) => {
    expect(validateDebriefBody({ missionId: "m1", session: { ...session, hintUsageCount } })).not.toBeNull();
  });

  it("accepts optional fields, known roles and supported hint levels", () => {
    for (const role of ["user", "npc", "system"]) {
      const valid = { ...session, hintLevel: 4, turns: [{ ...turn, role, understood: false,
        errorTags: ["word_order"], detectedScript: "hanzi", hintUsed: 4 }] };
      expect(validateChatBody({ ...chat, session: valid })).toBeNull();
      expect(validateDebriefBody({ missionId: "m1", session: { ...valid, hintUsageCount: 0 } })).toBeNull();
    }
  });
});
