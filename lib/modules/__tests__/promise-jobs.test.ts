import { describe, it, expect } from 'vitest'
import { FaradayCage } from '../../main'
import consoleModule from '../console'

describe('Promise Job Queue Execution', () => {
  it('should execute promise jobs correctly', async () => {
    const cage = await FaradayCage.create();
    const logs: string[] = [];
    
    const consoleHandler = {
      onLog: (_level: string, ...args: unknown[]) => {
        logs.push(args.map(String).join(' '));
      }
    };
    
    const code = `
      console.log("Start");
      
      Promise.resolve().then(() => {
        console.log("Promise 1");
        return Promise.resolve();
      }).then(() => {
        console.log("Promise 2");
      });
      
      Promise.resolve().then(() => {
        console.log("Promise 3");
      });
      
      console.log("End");
    `;

    const result = await cage.runCode(code, [
      consoleModule(consoleHandler)
    ]);
    
    expect(result.type).toBe('ok');
    // The order should be: Start, End (synchronous), then Promise 1, Promise 3, Promise 2
    expect(logs).toEqual([
      'Start',
      'End',
      'Promise 1',
      'Promise 3',
      'Promise 2'
    ]);
  });

  it('should handle async/await correctly', async () => {
    const cage = await FaradayCage.create();
    const logs: string[] = [];
    
    const consoleHandler = {
      onLog: (_level: string, ...args: unknown[]) => {
        logs.push(args.map(String).join(' '));
      }
    };
    
    const code = `
      async function test() {
        console.log("Async start");
        await Promise.resolve();
        console.log("After await 1");
        await Promise.resolve();
        console.log("After await 2");
      }
      
      test();
      console.log("Sync code");
    `;

    const result = await cage.runCode(code, [
      consoleModule(consoleHandler)
    ]);
    
    expect(result.type).toBe('ok');
    expect(logs).toEqual([
      'Async start',
      'Sync code',
      'After await 1',
      'After await 2'
    ]);
  });

  it('should handle promise rejections in job queue', async () => {
    const cage = await FaradayCage.create();
    const logs: string[] = [];
    
    const consoleHandler = {
      onLog: (_level: string, ...args: unknown[]) => {
        logs.push(args.map(String).join(' '));
      }
    };
    
    const code = `
      Promise.resolve().then(() => {
        console.log("Before rejection");
        throw new Error("Test error");
      }).catch(err => {
        console.log("Caught:", err.message);
      });
      
      console.log("Main code");
    `;

    const result = await cage.runCode(code, [
      consoleModule(consoleHandler)
    ]);
    
    expect(result.type).toBe('ok');
    expect(logs).toEqual([
      'Main code',
      'Before rejection',
      'Caught: Test error'
    ]);
  });
});