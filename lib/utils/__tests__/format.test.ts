import { describe, it, expect } from "vitest";
import { formatDateTime, formatDate, formatTime, formatFileSize } from "../format";

describe("formatDateTime", () => {
  it("应返回包含年月日的字符串", () => {
    const ts = new Date(2026, 0, 15, 14, 30, 45).getTime();
    const result = formatDateTime(ts);
    expect(result).toContain("2026");
    expect(result).toContain("01");
    expect(result).toContain("15");
  });
  it("应接受 Date 对象", () => {
    const d = new Date("2026-03-05T10:00:00");
    const result = formatDateTime(d);
    expect(result).toContain("2026");
  });
});

describe("formatDate", () => {
  it("应返回中文日期格式", () => {
    const ts = new Date(2026, 6, 4).getTime();
    const result = formatDate(ts);
    expect(result).toContain("2026");
    expect(result).toContain("07");
    expect(result).toContain("04");
  });
});

describe("formatTime", () => {
  it("应返回中文时间格式", () => {
    const d = new Date(2026, 0, 1, 9, 5, 30);
    const result = formatTime(d);
    expect(result).toContain("09");
    expect(result).toContain("05");
    expect(result).toContain("30");
  });
});

describe("formatFileSize", () => {
  it("应格式化 0 字节", () => {
    expect(formatFileSize(0)).toBe("0 B");
  });
  it("应格式化 KB", () => {
    expect(formatFileSize(1024)).toBe("1.0 KB");
    expect(formatFileSize(1536)).toBe("1.5 KB");
  });
  it("应格式化 MB", () => {
    expect(formatFileSize(1048576)).toBe("1.0 MB");
    expect(formatFileSize(2097152)).toBe("2.0 MB");
  });
  it("应格式化 GB", () => {
    expect(formatFileSize(1073741824)).toBe("1.0 GB");
  });
  it("应截断到超大值", () => {
    expect(formatFileSize(1099511627776)).toBe("1.0 TB");
  });
});
