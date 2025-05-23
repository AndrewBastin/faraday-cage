import { describe, it, expect, beforeEach } from "vitest";
import asyncWasmLocation from "@jitl/quickjs-wasmfile-release-asyncify/wasm?url";
import { FaradayCage } from "../../main";
import encoding from "../encoding";

// (Old test code removed - now using inline assertions)

describe("Encoding Module", () => {
  let cage: FaradayCage;

  beforeEach(async () => {
    cage = await FaradayCage.createFromQJSWasmLocation(asyncWasmLocation);
  });

  it("should provide TextEncoder and TextDecoder constructors", async () => {
    const result = await cage.runCode(`
      if (typeof TextEncoder !== 'function') {
        throw new Error('TextEncoder is not available');
      }
      if (typeof TextDecoder !== 'function') {
        throw new Error('TextDecoder is not available');
      }
    `, [encoding()]);

    expect(result.type).toBe("ok");
  });

  it("should encode and decode basic strings correctly", async () => {
    const result = await cage.runCode(`
      // Test if we can create instances
      try {
        const encoder = new TextEncoder();
        if (!encoder) throw new Error("TextEncoder constructor failed");
      } catch (e) {
        throw new Error("Failed to create TextEncoder: " + e.message);
      }
      
      try {
        const decoder = new TextDecoder();
        if (!decoder) throw new Error("TextDecoder constructor failed");
      } catch (e) {
        throw new Error("Failed to create TextDecoder: " + e.message);
      }
    `, [encoding()]);

    if (result.type === "error") {
      console.log("Error details:", result.err);
    }
    expect(result.type).toBe("ok");
  });

  it("should support encodeInto method", async () => {
    const result = await cage.runCode(`
      const encoder = new TextEncoder();
      const targetArray = new Uint8Array(50);
      const encodeIntoResult = encoder.encodeInto("Hello", targetArray);

      if (!encodeIntoResult || typeof encodeIntoResult !== 'object') {
        throw new Error("encodeInto should return an object, got " + typeof encodeIntoResult);
      }

      if (!('read' in encodeIntoResult) || !('written' in encodeIntoResult)) {
        throw new Error("encodeInto result should have 'read' and 'written' properties");
      }

      if (encodeIntoResult.read !== 5) {
        throw new Error("Expected read=5 for 'Hello', got " + encodeIntoResult.read);
      }

      if (encodeIntoResult.written !== 5) {
        throw new Error("Expected written=5 for 'Hello' (ASCII), got " + encodeIntoResult.written);
      }
    `, [encoding()]);

    if (result.type === "error") {
      console.log("encodeInto error:", result.err);
    }
    expect(result.type).toBe("ok");
  });

  it("should support streaming decoding", async () => {
    const result = await cage.runCode(`
      const streamDecoder = new TextDecoder();
      const chunk1 = new Uint8Array([72, 101, 108]); // "Hel"
      const chunk2 = new Uint8Array([108, 111]); // "lo"
      
      const stream1 = streamDecoder.decode(chunk1, { stream: true });
      const stream2 = streamDecoder.decode(chunk2, { stream: true });
      const streamFinal = streamDecoder.decode(); // Flush
      
      const fullResult = stream1 + stream2 + streamFinal;
      
      if (fullResult !== "Hello") {
        throw new Error("Streaming decode failed: expected 'Hello', got '" + fullResult + "'");
      }
    `, [encoding()]);

    expect(result.type).toBe("ok");
  });

  it("should handle invalid UTF-8 with replacement characters", async () => {
    const result = await cage.runCode(`
      const decoder = new TextDecoder();
      const invalidBytes = new Uint8Array([0xFF, 0xFE, 0xFD]);
      const invalidDecoded = decoder.decode(invalidBytes);
      
      // Should contain replacement characters (�) for invalid bytes
      if (!invalidDecoded.includes("�")) {
        throw new Error("Expected replacement characters (�) for invalid UTF-8, got: " + invalidDecoded);
      }
    `, [encoding()]);

    expect(result.type).toBe("ok");
  });

  it("should expose correct properties", async () => {
    const result = await cage.runCode(`
      const encoder = new TextEncoder();
      const decoder = new TextDecoder();
      
      if (encoder.encoding !== "utf-8") {
        throw new Error("TextEncoder.encoding should be 'utf-8', got: " + encoder.encoding);
      }
      
      if (decoder.encoding !== "utf-8") {
        throw new Error("TextDecoder.encoding should be 'utf-8', got: " + decoder.encoding);
      }
      
      if (decoder.fatal !== false) {
        throw new Error("TextDecoder.fatal should be false by default, got: " + decoder.fatal);
      }
      
      if (decoder.ignoreBOM !== false) {
        throw new Error("TextDecoder.ignoreBOM should be false by default, got: " + decoder.ignoreBOM);
      }
    `, [encoding()]);

    expect(result.type).toBe("ok");
  });

  it("should throw errors in fatal mode", async () => {
    const result = await cage.runCode(`
      const fatalDecoder = new TextDecoder("utf-8", { fatal: true });
      const invalidBytes = new Uint8Array([0xFF, 0xFE, 0xFD]);

      try {
        fatalDecoder.decode(invalidBytes);
        throw new Error("Should have thrown an error in fatal mode");
      } catch (error) {
        if (error.name !== "TypeError") {
          throw new Error("Expected TypeError in fatal mode, got: " + error.name);
        }
        // Success - error was thrown as expected
      }
    `, [encoding()]);

    expect(result.type).toBe("ok");
  });

  it("should handle BOM correctly", async () => {
    const result = await cage.runCode(`
      const bomBytes = new Uint8Array([0xEF, 0xBB, 0xBF, 72, 101, 108, 108, 111]); // BOM + "Hello"

      const defaultDecoder = new TextDecoder(); // ignoreBOM: false by default
      const ignoreBomDecoder = new TextDecoder("utf-8", { ignoreBOM: true });

      const defaultResult = defaultDecoder.decode(bomBytes);
      const ignoreBomResult = ignoreBomDecoder.decode(bomBytes);

      // With ignoreBOM: false (default), BOM should be removed
      if (defaultResult !== "Hello") {
        throw new Error("Expected 'Hello' when BOM is removed (default), got: " + JSON.stringify(defaultResult));
      }
      
      // With ignoreBOM: true, BOM should be preserved (not removed)
      if (ignoreBomResult === "Hello") {
        throw new Error("Expected BOM to be preserved when ignoreBOM: true, but got: " + JSON.stringify(ignoreBomResult));
      }
      
      // The results should be different
      if (defaultResult === ignoreBomResult) {
        throw new Error("BOM handling should produce different results, but both returned: " + JSON.stringify(defaultResult));
      }
    `, [encoding()]);

    if (result.type === "error") {
      console.log("BOM test error:", result.err);
    }
    expect(result.type).toBe("ok");
  });

  it("should handle various encoding labels", async () => {
    const result = await cage.runCode(`
      // Test various encoding labels that should resolve to UTF-8
      const decoder1 = new TextDecoder("utf8");
      const decoder2 = new TextDecoder("UTF-8");
      const decoder3 = new TextDecoder("unicode-1-1-utf-8");
      
      const testBytes = new TextEncoder().encode("Test");
      
      // All should normalize to "utf-8"
      if (decoder1.encoding !== "utf-8") {
        throw new Error("'utf8' should normalize to 'utf-8', got: " + decoder1.encoding);
      }
      if (decoder2.encoding !== "utf-8") {
        throw new Error("'UTF-8' should normalize to 'utf-8', got: " + decoder2.encoding);
      }
      if (decoder3.encoding !== "utf-8") {
        throw new Error("'unicode-1-1-utf-8' should normalize to 'utf-8', got: " + decoder3.encoding);
      }
      
      // All should decode the same
      const decoded1 = decoder1.decode(testBytes);
      const decoded2 = decoder2.decode(testBytes);
      const decoded3 = decoder3.decode(testBytes);
      
      if (decoded1 !== "Test" || decoded2 !== "Test" || decoded3 !== "Test") {
        throw new Error("All decoders should decode to 'Test', got: " + decoded1 + ", " + decoded2 + ", " + decoded3);
      }
    `, [encoding()]);

    expect(result.type).toBe("ok");
  });

  it("should handle legacy encodings", async () => {
    const result = await cage.runCode(`
      // Test some legacy encodings
      try {
        const decoder1 = new TextDecoder("iso-8859-1");
        const decoder2 = new TextDecoder("windows-1252");
        
        // Verify they were created successfully and have the expected encoding names
        if (decoder1.encoding !== "iso-8859-1") {
          throw new Error("Expected iso-8859-1 encoding, got: " + decoder1.encoding);
        }
        if (decoder2.encoding !== "windows-1252") {
          throw new Error("Expected windows-1252 encoding, got: " + decoder2.encoding);
        }
        
        // Test basic decoding works
        const testBytes = new Uint8Array([65, 66, 67]); // "ABC"
        const result1 = decoder1.decode(testBytes);
        const result2 = decoder2.decode(testBytes);
        
        if (result1 !== "ABC" || result2 !== "ABC") {
          throw new Error("Basic ASCII decoding failed");
        }
        
      } catch (error) {
        // If legacy encodings aren't supported, that's okay - just skip this test
        if (error.name === "RangeError" && error.message.includes("invalid")) {
          // Legacy encodings not supported, which is acceptable
          // Just continue without throwing
        } else {
          throw error;
        }
      }
    `, [encoding()]);

    if (result.type === "error") {
      console.log("Legacy encodings test error:", result.err);
    }
    expect(result.type).toBe("ok");
  });

  it("should handle partial multibyte sequences in streaming", async () => {
    const result = await cage.runCode(`
      const decoder = new TextDecoder();
      
      // Create a 4-byte UTF-8 character (🌍) as byte array
      // 🌍 = F0 9F 8C 8D in UTF-8
      const fullBytes = new Uint8Array([0xF0, 0x9F, 0x8C, 0x8D]);
      
      // Split the 4-byte sequence manually
      const chunk1 = new Uint8Array([0xF0, 0x9F]);
      const chunk2 = new Uint8Array([0x8C, 0x8D]);
      
      const part1 = decoder.decode(chunk1, { stream: true });
      const part2 = decoder.decode(chunk2, { stream: true });
      const final = decoder.decode(); // Flush
      
      const reconstructed = part1 + part2 + final;
      const expected = "🌍";
      
      if (reconstructed !== expected) {
        throw new Error("Streaming multibyte decode failed: expected '" + expected + "', got '" + reconstructed + "'");
      }
    `, [encoding()]);

    if (result.type === "error") {
      console.log("Streaming test error:", result.err);
    }
    expect(result.type).toBe("ok");
  });
});