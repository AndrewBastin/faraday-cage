import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import asyncWasmLocation from "@jitl/quickjs-wasmfile-release-asyncify/wasm?url"
import { FaradayCage } from '../../main'
import consoleModule, { ConsoleEventHandler, ConsoleEntry, ConsoleLogLevel } from '../console'

describe('Console Module', () => {
  let eventHandler: ConsoleEventHandler
  let capturedEntries: ConsoleEntry[] = []
  let logSpy: ReturnType<typeof vi.fn>
  let countSpy: ReturnType<typeof vi.fn>
  let timeSpy: ReturnType<typeof vi.fn>
  let timeLogSpy: ReturnType<typeof vi.fn>
  let groupSpy: ReturnType<typeof vi.fn>
  let groupEndSpy: ReturnType<typeof vi.fn>
  let clearSpy: ReturnType<typeof vi.fn>
  let assertSpy: ReturnType<typeof vi.fn>
  let dirSpy: ReturnType<typeof vi.fn>
  let tableSpy: ReturnType<typeof vi.fn>
  let finishSpy: ReturnType<typeof vi.fn>
  
  // Mock Date.now to return predictable values for timer tests
  const realDateNow = Date.now
  let dateNowCallCount = 0
  const mockedTimestamps = Array(10).fill(0).map((_, i) => 1000 + i * 500)
  
  beforeEach(() => {
    // Reset call count
    dateNowCallCount = 0
    
    // Setup Date.now mock
    Date.now = vi.fn(() => mockedTimestamps[dateNowCallCount++])
    
    // Create spies for all handlers
    logSpy = vi.fn()
    countSpy = vi.fn()
    timeSpy = vi.fn()
    timeLogSpy = vi.fn()
    groupSpy = vi.fn()
    groupEndSpy = vi.fn()
    clearSpy = vi.fn()
    assertSpy = vi.fn()
    dirSpy = vi.fn()
    tableSpy = vi.fn()
    finishSpy = vi.fn().mockImplementation((entries) => {
      capturedEntries = entries
    })
    
    capturedEntries = []
    eventHandler = {
      onLog: logSpy,
      onCount: countSpy,
      onTime: timeSpy,
      onTimeLog: timeLogSpy,
      onGroup: groupSpy,
      onGroupEnd: groupEndSpy,
      onClear: clearSpy,
      onAssert: assertSpy,
      onDir: dirSpy,
      onTable: tableSpy,
      onFinish: finishSpy
    }
  })
  
  afterEach(() => {
    // Restore original Date.now
    Date.now = realDateNow
    vi.clearAllMocks()
  })
  
  describe('Logging Functions', () => {
    it('should log messages with console.log', async () => {
      const cage = await FaradayCage.createFromQJSWasmLocation(asyncWasmLocation)
      
      await cage.runCode(`
        console.log('Hello, world!');
        console.log(42, true, { a: 1 });
      `, [consoleModule(eventHandler)])
      
      expect(logSpy).toHaveBeenCalledTimes(2)
      expect(logSpy).toHaveBeenNthCalledWith(1, 'log', 'Hello, world!')
      expect(logSpy).toHaveBeenNthCalledWith(2, 'log', 42, true, { a: 1 })
    })
    
    it('should support different log levels', async () => {
      const cage = await FaradayCage.createFromQJSWasmLocation(asyncWasmLocation)
      
      await cage.runCode(`
        console.log('log message');
        console.info('info message');
        console.warn('warn message');
        console.error('error message');
        console.debug('debug message');
        console.trace('trace message');
      `, [consoleModule(eventHandler)])
      
      expect(logSpy).toHaveBeenCalledTimes(6)
      
      const levels: ConsoleLogLevel[] = ['log', 'info', 'warn', 'error', 'debug', 'trace']
      const messages = ['log message', 'info message', 'warn message', 'error message', 'debug message', 'trace message']
      
      levels.forEach((level, i) => {
        expect(logSpy).toHaveBeenNthCalledWith(i + 1, level, messages[i])
      })
    })
  })
  
  describe('Counter Functions', () => {
    it('should handle console.count and maintain counter state', async () => {
      const cage = await FaradayCage.createFromQJSWasmLocation(asyncWasmLocation)
      
      await cage.runCode(`
        console.count('myLabel');
        console.count('myLabel');
        console.count('myLabel');
        console.count('anotherLabel');
        console.count(); // default label
      `, [consoleModule(eventHandler)])
      
      expect(countSpy).toHaveBeenCalledTimes(5)
      expect(countSpy).toHaveBeenNthCalledWith(1, 'myLabel', 1)
      expect(countSpy).toHaveBeenNthCalledWith(2, 'myLabel', 2)
      expect(countSpy).toHaveBeenNthCalledWith(3, 'myLabel', 3)
      expect(countSpy).toHaveBeenNthCalledWith(4, 'anotherLabel', 1)
      expect(countSpy).toHaveBeenNthCalledWith(5, 'default', 1)
    })
    
    it('should reset counters with console.countReset', async () => {
      const cage = await FaradayCage.createFromQJSWasmLocation(asyncWasmLocation)
      
      await cage.runCode(`
        console.count('test');
        console.count('test');
        console.countReset('test');
        console.count('test');
      `, [consoleModule(eventHandler)])
      
      expect(countSpy).toHaveBeenCalledTimes(3)
      expect(countSpy).toHaveBeenNthCalledWith(1, 'test', 1)
      expect(countSpy).toHaveBeenNthCalledWith(2, 'test', 2)
      expect(countSpy).toHaveBeenNthCalledWith(3, 'test', 1) // Back to 1 after reset
    })
  })
  
  describe('Timer Functions', () => {
    it('should track time with console.time and console.timeEnd', async () => {
      const cage = await FaradayCage.createFromQJSWasmLocation(asyncWasmLocation)
      
      await cage.runCode(`
        console.time('timer1');
        console.timeEnd('timer1');
      `, [consoleModule(eventHandler)])
      
      expect(timeSpy).toHaveBeenCalledWith('timer1', 500) // 500ms difference based on mocked timestamps
    })
    
    it('should support console.timeLog for interim time logging', async () => {
      const cage = await FaradayCage.createFromQJSWasmLocation(asyncWasmLocation)
      
      await cage.runCode(`
        console.time('timer1');
        console.timeLog('timer1', 'checkpoint');
        console.timeEnd('timer1');
      `, [consoleModule(eventHandler)])
      
      expect(timeLogSpy).toHaveBeenCalledWith('timer1', 500, 'checkpoint')
      expect(timeSpy).toHaveBeenCalledWith('timer1', 1000) // 1000ms total
    })
  })
  
  describe('Group Functions', () => {
    it('should support console.group and groupEnd', async () => {
      const cage = await FaradayCage.createFromQJSWasmLocation(asyncWasmLocation)
      
      await cage.runCode(`
        console.group('Group 1');
        console.log('Inside group 1');
        console.group('Group 2');
        console.log('Inside group 2');
        console.groupEnd();
        console.groupEnd();
      `, [consoleModule(eventHandler)])
      
      expect(groupSpy).toHaveBeenCalledTimes(2)
      expect(groupSpy).toHaveBeenNthCalledWith(1, 'Group 1', false)
      expect(groupSpy).toHaveBeenNthCalledWith(2, 'Group 2', false)
      expect(groupEndSpy).toHaveBeenCalledTimes(2)
    })
    
    it('should support console.groupCollapsed', async () => {
      const cage = await FaradayCage.createFromQJSWasmLocation(asyncWasmLocation)
      
      await cage.runCode(`
        console.groupCollapsed('Collapsed Group');
        console.log('Inside collapsed group');
        console.groupEnd();
      `, [consoleModule(eventHandler)])
      
      expect(groupSpy).toHaveBeenCalledWith('Collapsed Group', true)
      expect(groupEndSpy).toHaveBeenCalledTimes(1)
    })
    
    it('should handle extra console.groupEnd calls safely', async () => {
      const cage = await FaradayCage.createFromQJSWasmLocation(asyncWasmLocation)
      
      await cage.runCode(`
        console.group('Group');
        console.groupEnd();
        console.groupEnd(); // Extra call, shouldn't cause issues
      `, [consoleModule(eventHandler)])
      
      expect(groupSpy).toHaveBeenCalledTimes(1)
      expect(groupEndSpy).toHaveBeenCalledTimes(1) // Only called once despite two calls
    })
  })
  
  describe('Assert Function', () => {
    it('should support console.assert', async () => {
      const cage = await FaradayCage.createFromQJSWasmLocation(asyncWasmLocation)
      
      await cage.runCode(`
        console.assert(true, 'This should not trigger');
        console.assert(false, 'Assertion failed', { details: true });
      `, [consoleModule(eventHandler)])
      
      expect(assertSpy).toHaveBeenCalledTimes(1)
      expect(assertSpy).toHaveBeenCalledWith(false, 'Assertion failed', { details: true })
    })
  })
  
  describe('Clear Function', () => {
    it('should support console.clear', async () => {
      const cage = await FaradayCage.createFromQJSWasmLocation(asyncWasmLocation)
      
      await cage.runCode(`console.clear();`, [consoleModule(eventHandler)])
      
      expect(clearSpy).toHaveBeenCalledTimes(1)
    })
  })
  
  describe('Directory Functions', () => {
    it('should support console.dir', async () => {
      const cage = await FaradayCage.createFromQJSWasmLocation(asyncWasmLocation)
      
      await cage.runCode(`
        const obj = { a: 1, b: { c: 2 } };
        console.dir(obj, { depth: 2 });
      `, [consoleModule(eventHandler)])
      
      expect(dirSpy).toHaveBeenCalledWith({ a: 1, b: { c: 2 } }, { depth: 2 })
    })
    
    it('should have dirxml fallback to dir', async () => {
      const cage = await FaradayCage.createFromQJSWasmLocation(asyncWasmLocation)
      
      await cage.runCode(`
        const obj = { a: 1 };
        console.dirxml(obj);
      `, [consoleModule(eventHandler)])
      
      expect(dirSpy).toHaveBeenCalledWith({ a: 1 }, undefined)
    })
  })
  
  describe('Table Function', () => {
    it('should support console.table', async () => {
      const cage = await FaradayCage.createFromQJSWasmLocation(asyncWasmLocation)
      
      await cage.runCode(`
        const data = [{ a: 1, b: 2 }, { a: 3, b: 4 }];
        console.table(data, ['a']);
      `, [consoleModule(eventHandler)])
      
      expect(tableSpy).toHaveBeenCalledWith([{ a: 1, b: 2 }, { a: 3, b: 4 }], ['a'])
    })
  })
  
  describe('onFinish Handler', () => {
    it('should call onFinish with all entries when script completes', async () => {
      const cage = await FaradayCage.createFromQJSWasmLocation(asyncWasmLocation)
      
      await cage.runCode(`
        console.log('Message 1');
        console.warn('Warning');
        console.error('Error');
        console.count('counter');
        console.time('timer');
        console.timeEnd('timer');
      `, [consoleModule(eventHandler)])
      
      expect(finishSpy).toHaveBeenCalledTimes(1)
      expect(capturedEntries.length).toBe(6)
      
      // Check entry types in order
      expect(capturedEntries[0].type).toBe('log')
      expect(capturedEntries[1].type).toBe('warn')
      expect(capturedEntries[2].type).toBe('error')
      expect(capturedEntries[3].type).toBe('count')
      expect(capturedEntries[4].type).toBe('time')
      expect(capturedEntries[5].type).toBe('timeEnd')
      
      // Check timestamp format
      capturedEntries.forEach(entry => {
        expect(typeof entry.timestamp).toBe('number')
      })
    })
  })
})
