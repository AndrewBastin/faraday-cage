import { describe, it, expect, beforeEach } from "vitest";
import { FaradayCage } from "../../main";
import urlModule from "../url";

describe("URL Module", () => {
  let cage: FaradayCage;

  beforeEach(async () => {
    cage = await FaradayCage.create();
  });

  describe("URL class", () => {
    describe("constructor", () => {
      it("should parse absolute URLs correctly", async () => {
        console.log("Starting URL test...");
        
        try {
          const result = await cage.runCode(`
            const url = new URL("https://example.com:8080/path/to/resource?foo=bar&baz=qux#section");
            
            if (url.href !== "https://example.com:8080/path/to/resource?foo=bar&baz=qux#section") {
              throw new Error("href mismatch: " + url.href);
            }
            if (url.protocol !== "https:") {
              throw new Error("protocol mismatch: " + url.protocol);
            }
            if (url.host !== "example.com:8080") {
              throw new Error("host mismatch: " + url.host);
            }
            if (url.hostname !== "example.com") {
              throw new Error("hostname mismatch: " + url.hostname);
            }
            if (url.port !== "8080") {
              throw new Error("port mismatch: " + url.port);
            }
            if (url.pathname !== "/path/to/resource") {
              throw new Error("pathname mismatch: " + url.pathname);
            }
            if (url.search !== "?foo=bar&baz=qux") {
              throw new Error("search mismatch: " + url.search);
            }
            if (url.hash !== "#section") {
              throw new Error("hash mismatch: " + url.hash);
            }
            if (url.origin !== "https://example.com:8080") {
              throw new Error("origin mismatch: " + url.origin);
            }
            if (url.username !== "") {
              throw new Error("username should be empty: " + url.username);
            }
            if (url.password !== "") {
              throw new Error("password should be empty: " + url.password);
            }
          `, [urlModule()]);
          
          console.log("Test result:", result);
          
          if (result.type === "error") {
            console.error("Error details:", result.err);
            if (typeof result.err === 'object' && result.err !== null) {
              console.error("Error properties:", Object.keys(result.err));
              console.error("Error stringified:", JSON.stringify(result.err, null, 2));
            }
          }
          expect(result.type).toBe("ok");
        } catch (e) {
          console.error("Exception caught in test:", e);
          throw e;
        }
      });

      it("should parse URLs with authentication", async () => {
        const result = await cage.runCode(`
          const url = new URL("https://user:pass@example.com/");
          
          if (url.username !== "user") {
            throw new Error("username mismatch: " + url.username);
          }
          if (url.password !== "pass") {
            throw new Error("password mismatch: " + url.password);
          }
          if (url.host !== "example.com") {
            throw new Error("host mismatch: " + url.host);
          }
        `, [urlModule()]);
        
        expect(result.type).toBe("ok");
      });

      it("should parse relative URLs with base", async () => {
        const result = await cage.runCode(`
          const url = new URL("/path/to/resource", "https://example.com");
          
          if (url.href !== "https://example.com/path/to/resource") {
            throw new Error("href mismatch: " + url.href);
          }
        `, [urlModule()]);
        
        expect(result.type).toBe("ok");
      });

      it("should handle default ports", async () => {
        const result = await cage.runCode(`
          const httpUrl = new URL("http://example.com:80/");
          const httpsUrl = new URL("https://example.com:443/");
          
          if (httpUrl.port !== "") {
            throw new Error("HTTP default port should be empty: " + httpUrl.port);
          }
          if (httpsUrl.port !== "") {
            throw new Error("HTTPS default port should be empty: " + httpsUrl.port);
          }
          if (httpUrl.host !== "example.com") {
            throw new Error("HTTP host should not include default port: " + httpUrl.host);
          }
          if (httpsUrl.host !== "example.com") {
            throw new Error("HTTPS host should not include default port: " + httpsUrl.host);
          }
        `, [urlModule()]);
        
        expect(result.type).toBe("ok");
      });

      it("should throw on invalid URLs", async () => {
        const result = await cage.runCode(`
          try {
            new URL("not a url");
            throw new Error("Should have thrown on invalid URL");
          } catch (e) {
            if (e.name !== "TypeError" && !e.message.includes("Invalid URL")) {
              throw new Error("Expected TypeError or 'Invalid URL' message, got: " + e.name + " - " + e.message);
            }
          }
        `, [urlModule()]);
        
        expect(result.type).toBe("ok");
      });

      it("should handle percent encoding", async () => {
        const result = await cage.runCode(`
          const url = new URL("https://example.com/path with spaces?query=hello world");
          
          if (url.pathname !== "/path%20with%20spaces") {
            throw new Error("pathname not encoded correctly: " + url.pathname);
          }
          if (url.search !== "?query=hello%20world") {
            throw new Error("search not encoded correctly: " + url.search);
          }
          if (url.href !== "https://example.com/path%20with%20spaces?query=hello%20world") {
            throw new Error("href not encoded correctly: " + url.href);
          }
        `, [urlModule()]);
        
        expect(result.type).toBe("ok");
      });
    });

    describe("property setters", () => {
      it("should update href when setting properties", async () => {
        const result = await cage.runCode(`
          const url = new URL("https://example.com/");
          url.pathname = "/new/path";
          url.search = "?foo=bar";
          url.hash = "#section";
          
          if (url.href !== "https://example.com/new/path?foo=bar#section") {
            throw new Error("href not updated correctly: " + url.href);
          }
        `, [urlModule()]);
        
        expect(result.type).toBe("ok");
      });

      it("should update protocol", async () => {
        const result = await cage.runCode(`
          const url = new URL("https://example.com/");
          url.protocol = "http:";
          
          if (url.protocol !== "http:") {
            throw new Error("protocol not updated: " + url.protocol);
          }
          if (url.href !== "http://example.com/") {
            throw new Error("href not updated after protocol change: " + url.href);
          }
        `, [urlModule()]);
        
        expect(result.type).toBe("ok");
      });

      it("should update host and port", async () => {
        const result = await cage.runCode(`
          const url = new URL("https://example.com/");
          url.host = "newhost.com:9090";
          
          if (url.host !== "newhost.com:9090") {
            throw new Error("host not updated: " + url.host);
          }
          if (url.hostname !== "newhost.com") {
            throw new Error("hostname not updated: " + url.hostname);
          }
          if (url.port !== "9090") {
            throw new Error("port not updated: " + url.port);
          }
        `, [urlModule()]);
        
        expect(result.type).toBe("ok");
      });
    });

    describe("searchParams", () => {
      it("should provide URLSearchParams instance", async () => {
        const result = await cage.runCode(`
          const url = new URL("https://example.com/?foo=bar&baz=qux");
          
          if (!(url.searchParams instanceof URLSearchParams)) {
            throw new Error("searchParams is not an instance of URLSearchParams");
          }
        `, [urlModule()]);
        
        expect(result.type).toBe("ok");
      });

      it("should update URL when searchParams change", async () => {
        const result = await cage.runCode(`
          const url = new URL("https://example.com/?foo=bar");
          url.searchParams.set("foo", "newvalue");
          url.searchParams.append("baz", "qux");
          
          if (url.search !== "?foo=newvalue&baz=qux") {
            throw new Error("search not updated: " + url.search);
          }
        `, [urlModule()]);
        
        expect(result.type).toBe("ok");
      });
    });

    describe("toString and toJSON", () => {
      it("should serialize correctly", async () => {
        const result = await cage.runCode(`
          const url = new URL("https://example.com/path?query=value#hash");
          
          if (url.toString() !== "https://example.com/path?query=value#hash") {
            throw new Error("toString() incorrect: " + url.toString());
          }
          if (url.toJSON() !== "https://example.com/path?query=value#hash") {
            throw new Error("toJSON() incorrect: " + url.toJSON());
          }
          if (String(url) !== "https://example.com/path?query=value#hash") {
            throw new Error("String(url) incorrect: " + String(url));
          }
        `, [urlModule()]);
        
        expect(result.type).toBe("ok");
      });
    });
  });

  describe("URLSearchParams class", () => {
    describe("constructor", () => {
      it("should create from string", async () => {
        const result = await cage.runCode(`
          const params = new URLSearchParams("foo=bar&baz=qux&foo=another");
          
          if (params.toString() !== "foo=bar&baz=qux&foo=another") {
            throw new Error("toString() incorrect: " + params.toString());
          }
        `, [urlModule()]);
        
        expect(result.type).toBe("ok");
      });

      it("should create from object", async () => {
        const result = await cage.runCode(`
          const params = new URLSearchParams({ foo: "bar", baz: "qux" });
          
          if (params.toString() !== "foo=bar&baz=qux") {
            throw new Error("toString() incorrect: " + params.toString());
          }
        `, [urlModule()]);
        
        expect(result.type).toBe("ok");
      });

      it("should create from array of pairs", async () => {
        const result = await cage.runCode(`
          const params = new URLSearchParams([["foo", "bar"], ["baz", "qux"]]);
          
          if (params.toString() !== "foo=bar&baz=qux") {
            throw new Error("toString() incorrect: " + params.toString());
          }
        `, [urlModule()]);
        
        expect(result.type).toBe("ok");
      });

      it("should create from another URLSearchParams", async () => {
        const result = await cage.runCode(`
          const params1 = new URLSearchParams("foo=bar");
          const params2 = new URLSearchParams(params1);
          params2.append("baz", "qux");
          
          if (params1.toString() !== "foo=bar") {
            throw new Error("params1 modified unexpectedly: " + params1.toString());
          }
          if (params2.toString() !== "foo=bar&baz=qux") {
            throw new Error("params2 incorrect: " + params2.toString());
          }
        `, [urlModule()]);
        
        expect(result.type).toBe("ok");
      });
    });

    describe("methods", () => {
      it("should append values", async () => {
        const result = await cage.runCode(`
          const params = new URLSearchParams();
          params.append("foo", "bar");
          params.append("foo", "baz");
          
          if (params.toString() !== "foo=bar&foo=baz") {
            throw new Error("append failed: " + params.toString());
          }
        `, [urlModule()]);
        
        expect(result.type).toBe("ok");
      });

      it("should set values", async () => {
        const result = await cage.runCode(`
          const params = new URLSearchParams("foo=bar&foo=baz");
          params.set("foo", "qux");
          
          if (params.toString() !== "foo=qux") {
            throw new Error("set failed: " + params.toString());
          }
        `, [urlModule()]);
        
        expect(result.type).toBe("ok");
      });

      it("should get values", async () => {
        const result = await cage.runCode(`
          const params = new URLSearchParams("foo=bar&foo=baz&qux=quux");
          
          if (params.get("foo") !== "bar") {
            throw new Error("get() returned wrong value: " + params.get("foo"));
          }
          
          const allFoo = params.getAll("foo");
          if (allFoo.length !== 2 || allFoo[0] !== "bar" || allFoo[1] !== "baz") {
            throw new Error("getAll() returned wrong values: " + JSON.stringify(allFoo));
          }
          
          if (params.get("missing") !== null) {
            throw new Error("get() should return null for missing key");
          }
        `, [urlModule()]);
        
        expect(result.type).toBe("ok");
      });

      it("should check existence with has", async () => {
        const result = await cage.runCode(`
          const params = new URLSearchParams("foo=bar");
          
          if (!params.has("foo")) {
            throw new Error("has() should return true for existing key");
          }
          if (params.has("baz")) {
            throw new Error("has() should return false for missing key");
          }
        `, [urlModule()]);
        
        expect(result.type).toBe("ok");
      });

      it("should delete values", async () => {
        const result = await cage.runCode(`
          const params = new URLSearchParams("foo=bar&foo=baz&qux=quux");
          params.delete("foo");
          
          if (params.toString() !== "qux=quux") {
            throw new Error("delete failed: " + params.toString());
          }
        `, [urlModule()]);
        
        expect(result.type).toBe("ok");
      });

      it("should sort parameters", async () => {
        const result = await cage.runCode(`
          const params = new URLSearchParams("z=1&a=2&m=3");
          params.sort();
          
          if (params.toString() !== "a=2&m=3&z=1") {
            throw new Error("sort failed: " + params.toString());
          }
        `, [urlModule()]);
        
        expect(result.type).toBe("ok");
      });

      it("should handle percent encoding", async () => {
        const result = await cage.runCode(`
          const params = new URLSearchParams();
          params.set("name", "hello world");
          params.set("emoji", "😀");
          
          if (params.toString() !== "name=hello+world&emoji=%F0%9F%98%80") {
            throw new Error("encoding incorrect: " + params.toString());
          }
        `, [urlModule()]);
        
        expect(result.type).toBe("ok");
      });
    });

    describe("iteration", () => {
      it("should iterate with forEach", async () => {
        const result = await cage.runCode(`
          const params = new URLSearchParams("a=1&b=2&c=3");
          const results = [];
          params.forEach((value, key) => {
            results.push({ key, value });
          });
          
          if (results.length !== 3) {
            throw new Error("forEach didn't iterate all items");
          }
          if (results[0].key !== "a" || results[0].value !== "1") {
            throw new Error("forEach first item incorrect");
          }
          if (results[1].key !== "b" || results[1].value !== "2") {
            throw new Error("forEach second item incorrect");
          }
          if (results[2].key !== "c" || results[2].value !== "3") {
            throw new Error("forEach third item incorrect");
          }
        `, [urlModule()]);
        
        expect(result.type).toBe("ok");
      });

      it("should iterate with for...of", async () => {
        const result = await cage.runCode(`
          const params = new URLSearchParams("a=1&b=2");
          const entries = [];
          for (const [key, value] of params) {
            entries.push([key, value]);
          }
          
          if (entries.length !== 2) {
            throw new Error("for...of didn't iterate all items");
          }
          if (entries[0][0] !== "a" || entries[0][1] !== "1") {
            throw new Error("for...of first item incorrect");
          }
          if (entries[1][0] !== "b" || entries[1][1] !== "2") {
            throw new Error("for...of second item incorrect");
          }
        `, [urlModule()]);
        
        expect(result.type).toBe("ok");
      });

      it("should provide keys(), values(), and entries()", async () => {
        const result = await cage.runCode(`
          const params = new URLSearchParams("a=1&b=2");
          
          const keys = Array.from(params.keys());
          if (keys.length !== 2 || keys[0] !== "a" || keys[1] !== "b") {
            throw new Error("keys() incorrect: " + JSON.stringify(keys));
          }
          
          const values = Array.from(params.values());
          if (values.length !== 2 || values[0] !== "1" || values[1] !== "2") {
            throw new Error("values() incorrect: " + JSON.stringify(values));
          }
          
          const entries = Array.from(params.entries());
          if (entries.length !== 2 || entries[0][0] !== "a" || entries[0][1] !== "1" || entries[1][0] !== "b" || entries[1][1] !== "2") {
            throw new Error("entries() incorrect: " + JSON.stringify(entries));
          }
        `, [urlModule()]);
        
        expect(result.type).toBe("ok");
      });
    });
  });
});