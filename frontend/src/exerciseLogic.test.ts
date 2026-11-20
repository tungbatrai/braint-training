import { describe, it, expect } from "vitest";
import { remainingSeconds, createChoiceLock } from "./exerciseLogic";

describe("bộ đếm và khóa đáp án", () => {
  it("tính thời gian theo đồng hồ máy chủ và không âm", () => {
    expect(remainingSeconds(16000, 10000, 100, 2100)).toBe(4);
    expect(remainingSeconds(16000, 10000, 100, 9000)).toBe(0);
  });
  it("chỉ cho gửi một đáp án đến khi câu hỏi thay đổi", () => {
    const lock = createChoiceLock();
    expect(lock.acquire()).toBe(true);
    expect(lock.acquire()).toBe(false);
    lock.reset();
    expect(lock.acquire()).toBe(true);
  });
});
