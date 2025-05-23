import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { FaradayCage } from '../../main'
import timers from '../timers'
import consoleModule from '../console'

describe('Timers Module', () => {
  let cage: FaradayCage;
  let logs: string[] = [];
  
  // Create console event handler to capture output
  const createConsoleHandler = () => {
    logs = [];
    return {
      onLog: (_level: string, ...args: unknown[]) => {
        logs.push(args.map(String).join(' '));
      }
    };
  };

  beforeEach(async () => {
    cage = await FaradayCage.create();
    logs = [];
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('setTimeout', () => {
    it('should execute callback after specified delay', async () => {
      const code = `
        setTimeout(() => console.log("timeout fired"), 1000);
      `;

      const runPromise = cage.runCode(code, [
        timers(),
        consoleModule(createConsoleHandler())
      ]);

      // Should not fire immediately
      expect(logs).toEqual([]);

      // Advance time
      await vi.advanceTimersByTimeAsync(1000);

      // Wait for execution to complete
      const result = await runPromise;
      expect(result.type).toBe('ok');
      expect(logs).toEqual(['timeout fired']);
    });

    it('should pass arguments to callback', async () => {
      const code = `
        setTimeout((a, b, c) => console.log(a, b, c), 100, "hello", 42, true);
      `;

      const runPromise = cage.runCode(code, [
        timers(),
        consoleModule(createConsoleHandler())
      ]);

      await vi.advanceTimersByTimeAsync(100);
      const result = await runPromise;
      
      expect(result.type).toBe('ok');
      expect(logs).toEqual(['hello 42 true']);
    });

    it('should handle zero delay', async () => {
      const code = `
        setTimeout(() => console.log("immediate"), 0);
      `;

      const runPromise = cage.runCode(code, [
        timers(),
        consoleModule(createConsoleHandler())
      ]);

      await vi.advanceTimersByTimeAsync(0);
      const result = await runPromise;
      
      expect(result.type).toBe('ok');
      expect(logs).toEqual(['immediate']);
    });

    it('should handle missing delay parameter', async () => {
      const code = `
        setTimeout(() => console.log("no delay"));
      `;

      const runPromise = cage.runCode(code, [
        timers(),
        consoleModule(createConsoleHandler())
      ]);

      await vi.advanceTimersByTimeAsync(0);
      const result = await runPromise;
      
      expect(result.type).toBe('ok');
      expect(logs).toEqual(['no delay']);
    });

    it('should return timer ID', async () => {
      const code = `
        const id = setTimeout(() => {}, 1000);
        console.log(typeof id === 'number' && id > 0);
        clearTimeout(id);
      `;

      const result = await cage.runCode(code, [
        timers(),
        consoleModule(createConsoleHandler())
      ]);

      expect(result.type).toBe('ok');
      expect(logs).toEqual(['true']);
    });

    it('should handle negative delays as zero', async () => {
      const code = `
        setTimeout(() => console.log("negative delay"), -100);
      `;

      const runPromise = cage.runCode(code, [
        timers(),
        consoleModule(createConsoleHandler())
      ]);

      await vi.advanceTimersByTimeAsync(0);
      const result = await runPromise;
      
      expect(result.type).toBe('ok');
      expect(logs).toEqual(['negative delay']);
    });

    it('should cap extremely large delays', async () => {
      const code = `
        const maxDelay = 2147483647;
        const id = setTimeout(() => console.log("max delay"), maxDelay + 1000);
        console.log("timer set");
        clearTimeout(id);
      `;

      const result = await cage.runCode(code, [
        timers(),
        consoleModule(createConsoleHandler())
      ]);

      expect(result.type).toBe('ok');
      expect(logs).toEqual(['timer set']);
    });
  });

  describe('setInterval', () => {
    it('should execute callback repeatedly', async () => {
      const code = `
        let count = 0;
        const id = setInterval(() => {
          count++;
          console.log("tick " + count);
          if (count >= 3) {
            clearInterval(id);
          }
        }, 100);
      `;

      const runPromise = cage.runCode(code, [
        timers(),
        consoleModule(createConsoleHandler())
      ]);

      // Advance through multiple intervals
      await vi.advanceTimersByTimeAsync(100);
      expect(logs).toEqual(['tick 1']);

      await vi.advanceTimersByTimeAsync(100);
      expect(logs).toEqual(['tick 1', 'tick 2']);

      await vi.advanceTimersByTimeAsync(100);
      expect(logs).toEqual(['tick 1', 'tick 2', 'tick 3']);

      // Should not execute after clearing
      await vi.advanceTimersByTimeAsync(100);
      expect(logs).toEqual(['tick 1', 'tick 2', 'tick 3']);

      const result = await runPromise;
      expect(result.type).toBe('ok');
    });

    it('should pass arguments to interval callback', async () => {
      const code = `
        let count = 0;
        const id = setInterval((prefix) => {
          count++;
          console.log(prefix + count);
          if (count >= 2) clearInterval(id);
        }, 50, "interval ");
      `;

      const runPromise = cage.runCode(code, [
        timers(),
        consoleModule(createConsoleHandler())
      ]);

      await vi.advanceTimersByTimeAsync(50);
      await vi.advanceTimersByTimeAsync(50);
      
      const result = await runPromise;
      expect(result.type).toBe('ok');
      expect(logs).toEqual(['interval 1', 'interval 2']);
    });

    it('should return timer ID', async () => {
      const code = `
        const id = setInterval(() => {}, 1000);
        console.log(typeof id === 'number' && id > 0);
        clearInterval(id);
      `;

      const result = await cage.runCode(code, [
        timers(),
        consoleModule(createConsoleHandler())
      ]);

      expect(result.type).toBe('ok');
      expect(logs).toEqual(['true']);
    });
  });

  describe('clearTimeout', () => {
    it('should cancel a pending timeout', async () => {
      const code = `
        const id = setTimeout(() => console.log("should not run"), 1000);
        clearTimeout(id);
        console.log("cleared");
      `;

      const runPromise = cage.runCode(code, [
        timers(),
        consoleModule(createConsoleHandler())
      ]);

      expect(logs).toEqual(['cleared']);

      await vi.advanceTimersByTimeAsync(1000);
      const result = await runPromise;
      
      expect(result.type).toBe('ok');
      expect(logs).toEqual(['cleared']); // Callback should not have run
    });

    it('should handle invalid timer IDs gracefully', async () => {
      const code = `
        clearTimeout(999);
        clearTimeout(null);
        clearTimeout(undefined);
        clearTimeout("not a number");
        console.log("all cleared");
      `;

      const result = await cage.runCode(code, [
        timers(),
        consoleModule(createConsoleHandler())
      ]);

      expect(result.type).toBe('ok');
      expect(logs).toEqual(['all cleared']);
    });

    it('should work with IDs from setInterval', async () => {
      const code = `
        const id = setInterval(() => console.log("interval"), 100);
        clearTimeout(id); // Per spec, can use interchangeably
        console.log("cleared with clearTimeout");
      `;

      const runPromise = cage.runCode(code, [
        timers(),
        consoleModule(createConsoleHandler())
      ]);

      expect(logs).toEqual(['cleared with clearTimeout']);

      await vi.advanceTimersByTimeAsync(100);
      const result = await runPromise;
      
      expect(result.type).toBe('ok');
      expect(logs).toEqual(['cleared with clearTimeout']);
    });
  });

  describe('clearInterval', () => {
    it('should cancel a running interval', async () => {
      const code = `
        let count = 0;
        const id = setInterval(() => {
          count++;
          console.log("tick " + count);
        }, 100);
        
        setTimeout(() => {
          clearInterval(id);
          console.log("interval cleared");
        }, 250);
      `;

      const runPromise = cage.runCode(code, [
        timers(),
        consoleModule(createConsoleHandler())
      ]);

      await vi.advanceTimersByTimeAsync(100);
      expect(logs).toEqual(['tick 1']);

      await vi.advanceTimersByTimeAsync(100);
      expect(logs).toEqual(['tick 1', 'tick 2']);

      await vi.advanceTimersByTimeAsync(50);
      expect(logs).toEqual(['tick 1', 'tick 2', 'interval cleared']);

      // Should not tick again
      await vi.advanceTimersByTimeAsync(100);
      expect(logs).toEqual(['tick 1', 'tick 2', 'interval cleared']);

      const result = await runPromise;
      expect(result.type).toBe('ok');
    });

    it('should handle invalid timer IDs gracefully', async () => {
      const code = `
        clearInterval(999);
        clearInterval(null);
        clearInterval(undefined);
        clearInterval("not a number");
        console.log("all cleared");
      `;

      const result = await cage.runCode(code, [
        timers(),
        consoleModule(createConsoleHandler())
      ]);

      expect(result.type).toBe('ok');
      expect(logs).toEqual(['all cleared']);
    });
  });

  describe('Multiple timers', () => {
    it('should handle multiple concurrent timers', async () => {
      const code = `
        setTimeout(() => console.log("timeout 1"), 100);
        setTimeout(() => console.log("timeout 2"), 200);
        setTimeout(() => console.log("timeout 3"), 50);
        
        const id = setInterval(() => console.log("interval"), 75);
        setTimeout(() => clearInterval(id), 180);
      `;

      const runPromise = cage.runCode(code, [
        timers(),
        consoleModule(createConsoleHandler())
      ]);

      await vi.advanceTimersByTimeAsync(50);
      expect(logs).toEqual(['timeout 3']);

      await vi.advanceTimersByTimeAsync(25); // 75 total
      expect(logs).toEqual(['timeout 3', 'interval']);

      await vi.advanceTimersByTimeAsync(25); // 100 total
      expect(logs).toEqual(['timeout 3', 'interval', 'timeout 1']);

      await vi.advanceTimersByTimeAsync(50); // 150 total
      expect(logs).toEqual(['timeout 3', 'interval', 'timeout 1', 'interval']);

      await vi.advanceTimersByTimeAsync(30); // 180 total
      expect(logs).toEqual(['timeout 3', 'interval', 'timeout 1', 'interval']);

      await vi.advanceTimersByTimeAsync(20); // 200 total
      expect(logs).toEqual(['timeout 3', 'interval', 'timeout 1', 'interval', 'timeout 2']);

      const result = await runPromise;
      expect(result.type).toBe('ok');
    });

    it('should maintain separate timer ID counters', async () => {
      const code = `
        const id1 = setTimeout(() => {}, 100);
        const id2 = setInterval(() => {}, 100);
        const id3 = setTimeout(() => {}, 100);
        
        console.log(id1 !== id2 && id2 !== id3 && id1 !== id3);
        
        clearTimeout(id1);
        clearInterval(id2);
        clearTimeout(id3);
      `;

      const result = await cage.runCode(code, [
        timers(),
        consoleModule(createConsoleHandler())
      ]);

      expect(result.type).toBe('ok');
      expect(logs).toEqual(['true']);
    });
  });

  describe('Error handling', () => {
    it('should require function as first argument', async () => {
      const code = `
        try {
          setTimeout("console.log('string handler')", 100);
          console.log("should not reach here");
        } catch (e) {
          console.log("caught error");
        }
      `;

      const result = await cage.runCode(code, [
        timers(),
        consoleModule(createConsoleHandler())
      ]);

      expect(result.type).toBe('ok');
      expect(logs).toEqual(['caught error']);
    });

    it('should handle errors in timer callbacks gracefully', async () => {
      const code = `
        setTimeout(() => {
          throw new Error("timer error");
        }, 50);
        
        setTimeout(() => {
          console.log("second timer still runs");
        }, 100);
      `;

      const runPromise = cage.runCode(code, [
        timers(),
        consoleModule(createConsoleHandler())
      ]);

      await vi.advanceTimersByTimeAsync(50);
      await vi.advanceTimersByTimeAsync(50);

      const result = await runPromise;
      expect(result.type).toBe('ok');
      expect(logs).toEqual(['second timer still runs']);
    });
  });

  describe('Edge cases', () => {
    it('should handle clearing timers from within callbacks', async () => {
      const code = `
        let timeoutId;
        let intervalId;
        
        timeoutId = setTimeout(() => {
          console.log("timeout clearing itself");
          clearTimeout(timeoutId); // Already fired, should be no-op
        }, 50);
        
        let count = 0;
        intervalId = setInterval(() => {
          count++;
          console.log("interval " + count);
          if (count === 2) {
            clearInterval(intervalId);
          }
        }, 50);
      `;

      const runPromise = cage.runCode(code, [
        timers(),
        consoleModule(createConsoleHandler())
      ]);

      await vi.advanceTimersByTimeAsync(50);
      expect(logs).toEqual(['timeout clearing itself', 'interval 1']);

      await vi.advanceTimersByTimeAsync(50);
      expect(logs).toEqual(['timeout clearing itself', 'interval 1', 'interval 2']);

      await vi.advanceTimersByTimeAsync(50);
      expect(logs).toEqual(['timeout clearing itself', 'interval 1', 'interval 2']);

      const result = await runPromise;
      expect(result.type).toBe('ok');
    });

    it('should handle nested timer creation', async () => {
      const code = `
        setTimeout(() => {
          console.log("outer timeout");
          setTimeout(() => {
            console.log("inner timeout");
          }, 50);
        }, 50);
      `;

      const runPromise = cage.runCode(code, [
        timers(),
        consoleModule(createConsoleHandler())
      ]);

      await vi.advanceTimersByTimeAsync(50);
      expect(logs).toEqual(['outer timeout']);

      await vi.advanceTimersByTimeAsync(50);
      expect(logs).toEqual(['outer timeout', 'inner timeout']);

      const result = await runPromise;
      expect(result.type).toBe('ok');
    });

    it('should handle this context in timer callbacks', async () => {
      const code = `
        const obj = {
          value: 42,
          method() {
            console.log("method this.value:", this?.value);
          }
        };
        
        // Direct method reference loses context
        setTimeout(obj.method, 50);
        
        // Arrow function preserves outer scope
        setTimeout(() => obj.method(), 100);
        
        // Bind preserves context
        setTimeout(obj.method.bind(obj), 150);
      `;

      const runPromise = cage.runCode(code, [
        timers(),
        consoleModule(createConsoleHandler())
      ]);

      await vi.advanceTimersByTimeAsync(50);
      expect(logs).toEqual(['method this.value: undefined']);

      await vi.advanceTimersByTimeAsync(50);
      expect(logs).toEqual(['method this.value: undefined', 'method this.value: 42']);

      await vi.advanceTimersByTimeAsync(50);
      expect(logs).toEqual(['method this.value: undefined', 'method this.value: 42', 'method this.value: 42']);

      const result = await runPromise;
      expect(result.type).toBe('ok');
    });
  });
});