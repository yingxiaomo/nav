import { describe, it, expect } from "vitest";
import { encryptData, decryptData, safeLocalStorageSet, safeLocalStorageGet } from "../encryption";

describe("encryptData / decryptData", () => {
  it("应正确编码解码普通字符串", () => {
    const original = "hello world";
    const encoded = encryptData(original);
    expect(encoded).not.toBe(original);
    expect(decryptData(encoded)).toBe(original);
  });

  it("应处理含特殊字符的字符串", () => {
    const original = "a+b/c=d&e=f!@#$%^&*()";
    const encoded = encryptData(original);
    expect(decryptData(encoded)).toBe(original);
  });

  it("应处理空字符串", () => {
    expect(encryptData("")).toBe("");
    // atob("") 返回 ""，btoa("") === "" 校验通过 → 返回空字符串
    expect(decryptData("")).toBe("");
  });

  it("非 base64 输入应返回 null", () => {
    // 非 base64 字符导致 atob 抛出异常
    expect(decryptData("!!!invalid-base64!!!")).toBeNull();
  });
});

describe("safeLocalStorageGet", () => {
  it("在新格式 __b64__ 前缀下应正确解码", () => {
    const key = "__test_b64_data";
    const value = { name: "test", value: 42 };
    const b64 = btoa(JSON.stringify(value));
    localStorage.setItem(key, "__b64__" + b64);
    const result = safeLocalStorageGet<typeof value>(key);
    expect(result).toEqual(value);
    localStorage.removeItem(key);
  });

  it("在旧明文 JSON 格式下应正确解析", () => {
    const key = "__test_plain_data";
    const value = { name: "plain" };
    localStorage.setItem(key, JSON.stringify(value));
    const result = safeLocalStorageGet<typeof value>(key);
    expect(result).toEqual(value);
    localStorage.removeItem(key);
  });

  it("在旧 AES-GCM 格式（非 JSON、非 __b64__ 前缀）下应安全降级返回 null", () => {
    const key = "__test_old_encrypted";
    // 旧 AES-GCM 加密数据：既不是 JSON 对象/数组，也没有 __b64__ 前缀
    localStorage.setItem(key, "U2FsdGVkX18yMDE4MDkwNlRlc3Q=");
    const result = safeLocalStorageGet(key);
    expect(result).toBeNull();
    localStorage.removeItem(key);
  });

  it("在 key 不存在时应返回 null", () => {
    const result = safeLocalStorageGet("__nonexistent_key__");
    expect(result).toBeNull();
  });
});
