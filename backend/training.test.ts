import { describe, expect, it } from "vitest";
import { createMath, createMemory, advance, view } from "./training";

describe("training engine", () => {
  it("expires math questions using their original deadlines", () => {
    const s = createMath(1000);
    advance(s, 1000 + 16000 + 15000);
    expect(s.index).toBe(2);
    expect(s.answers).toHaveLength(2);
    expect(s.deadline).toBe(1000 + 16000 + 15000 + 14000);
  });
  it("does not reveal memory words after recall starts", () => {
    const s = createMemory(1000);
    advance(s, 31000);
    const result = view("id", "memory", s, 31000);
    expect(result.words).toBeUndefined();
    expect(result.question?.choices).toHaveLength(4);
    expect(s.words).toHaveLength(6);
    expect(new Set(s.words).size).toBe(6);
  });
});

it("expires every math question at its deadline without resetting time", () => {
  const s = createMath(0);
  advance(s, 115000);
  expect(s.status).toBe("SUBMITTED");
  expect(s.answers).toHaveLength(10);
  expect(s.score).toBe(0);
  expect(s.answers.every((a) => a.selectedChoiceId === null)).toBe(true);
});
