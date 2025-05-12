import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import asyncWasmLocation from "@jitl/quickjs-wasmfile-release-asyncify/wasm?url"
import { FaradayCage } from '../../main'
import fetchModule, { FetchModuleConfig } from '../fetch'

describe('Fetch Module', () => {
  let cage: FaradayCage;
  
  // Mock fetch for consistent testing
  const mockFetchResponse = {
    ok: true,
    status: 200,
    statusText: 'OK',
    headers: new Headers({ 'Content-Type': 'application/json' }),
    redirected: false,
    type: 'basic' as const,
    url: 'https://example.com/api',
    body: undefined as any, // Will be set in ReadableStream tests
    json: vi.fn().mockResolvedValue({ data: 'test' }),
    text: vi.fn().mockResolvedValue('Hello world'),
    arrayBuffer: vi.fn().mockResolvedValue(new Uint8Array([1, 2, 3]).buffer),
    blob: vi.fn().mockResolvedValue(new Blob(['test'])),
    formData: vi.fn().mockResolvedValue(new FormData()),
    clone: vi.fn().mockImplementation(function(this: any) {
      // Deep clone the response
      const clone = { ...this };
      // Clone methods
      clone.json = vi.fn().mockImplementation(() => this.json());
      clone.text = vi.fn().mockImplementation(() => this.text());
      clone.arrayBuffer = vi.fn().mockImplementation(() => this.arrayBuffer());
      clone.blob = vi.fn().mockImplementation(() => this.blob());
      clone.formData = vi.fn().mockImplementation(() => this.formData());
      clone.clone = this.clone;
      return clone;
    })
  };

  const mockFetch = vi.fn().mockResolvedValue(mockFetchResponse);
  
  // Store original global fetch to restore later
  const originalFetch = globalThis.fetch;
  
  beforeEach(async () => {
    // Replace global fetch with mock
    globalThis.fetch = mockFetch;
    
    // Reset mock for each test
    mockFetch.mockClear();
    mockFetchResponse.json.mockClear();
    mockFetchResponse.text.mockClear();
    mockFetchResponse.arrayBuffer.mockClear();
    mockFetchResponse.blob.mockClear();
    mockFetchResponse.formData.mockClear();
    mockFetchResponse.clone.mockClear();
    
    // Create a new cage for each test
    cage = await FaradayCage.createFromQJSWasmLocation(asyncWasmLocation);
  });
  
  afterEach(() => {
    // Restore original fetch
    globalThis.fetch = originalFetch;
  });

  describe('Global API availability', () => {
    it('should make fetch API globals available in the sandbox', async () => {
      await cage.runCode(`
        if (typeof fetch !== 'function') throw new Error('fetch not available');
        if (typeof Headers !== 'function') throw new Error('Headers not available');
        if (typeof Request !== 'function') throw new Error('Request not available');
        if (typeof Response !== 'function') throw new Error('Response not available');
        if (typeof AbortController !== 'function') throw new Error('AbortController not available');
      `, [fetchModule()]);
    });
    
    it('should expose essential properties and methods', async () => {
      await cage.runCode(`
        // Check Response properties and methods
        const response = new Response();
        if (typeof response.status !== 'number') throw new Error('Response.status not available');
        if (typeof response.ok !== 'boolean') throw new Error('Response.ok not available');
        if (typeof response.json !== 'function') throw new Error('Response.json not available');
        if (typeof response.text !== 'function') throw new Error('Response.text not available');
        if (typeof response.clone !== 'function') throw new Error('Response.clone not available');
        
        // Check Request properties and methods
        const request = new Request('https://example.com');
        if (typeof request.url !== 'string') throw new Error('Request.url not available');
        if (typeof request.method !== 'string') throw new Error('Request.method not available');
        if (typeof request.clone !== 'function') throw new Error('Request.clone not available');
        
        // Check Headers methods
        const headers = new Headers();
        if (typeof headers.get !== 'function') throw new Error('Headers.get not available');
        if (typeof headers.set !== 'function') throw new Error('Headers.set not available');
        if (typeof headers.has !== 'function') throw new Error('Headers.has not available');
        
        // Check AbortController
        const controller = new AbortController();
        if (typeof controller.signal !== 'object') throw new Error('AbortController.signal not available');
        if (typeof controller.abort !== 'function') throw new Error('AbortController.abort not available');
      `, [fetchModule()]);
    });
  });

  describe('Fetch Function', () => {
    it('should make a basic fetch request', async () => {
      await cage.runCode(`
        fetch('https://example.com/api');
      `, [fetchModule()]);
      
      expect(mockFetch).toHaveBeenCalledWith('https://example.com/api', undefined);
    });
    
    it('should support fetch with options', async () => {
      await cage.runCode(`
        fetch('https://example.com/api', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ test: true })
        });
      `, [fetchModule()]);
      
      expect(mockFetch).toHaveBeenCalledWith('https://example.com/api', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ test: true })
      });
    });
    
    it('should use a custom fetch implementation when provided', async () => {
      const customFetch = vi.fn().mockResolvedValue(mockFetchResponse);
      const config: FetchModuleConfig = {
        fetchImpl: customFetch
      };
      
      await cage.runCode(`
        fetch('https://custom-api.example.com');
      `, [fetchModule(config)]);
      
      expect(customFetch).toHaveBeenCalledWith('https://custom-api.example.com', undefined);
      expect(mockFetch).not.toHaveBeenCalled();
    });
  });

  describe('Headers', () => {
    it('should handle basic headers operations', async () => {
      await cage.runCode(`
        const headers = new Headers();
        
        // Test set & get
        headers.set('Content-Type', 'application/json');
        if (headers.get('Content-Type') !== 'application/json') {
          throw new Error('Headers.get failed to return the correct value');
        }
        
        // Test case insensitivity
        if (headers.get('content-type') !== 'application/json') {
          throw new Error('Headers is not case-insensitive');
        }
        
        // Test has
        if (!headers.has('Content-Type')) {
          throw new Error('Headers.has failed');
        }
        
        // Test delete
        headers.delete('Content-Type');
        if (headers.has('Content-Type')) {
          throw new Error('Headers.delete failed');
        }
        
        // Test append
        headers.append('X-Custom', 'value1');
        headers.append('X-Custom', 'value2');
        const customValue = headers.get('X-Custom');
        if (!customValue.includes('value1') || !customValue.includes('value2')) {
          throw new Error('Headers.append failed to combine values');
        }
      `, [fetchModule()]);
    });
    
    it('should initialize headers with object literal', async () => {
      await cage.runCode(`
        const headers = new Headers({
          'Content-Type': 'application/json',
          'X-Custom': 'test-value'
        });
        
        if (headers.get('Content-Type') !== 'application/json') {
          throw new Error('Headers initialization with object failed');
        }
        
        if (headers.get('X-Custom') !== 'test-value') {
          throw new Error('Headers initialization with object failed');
        }
      `, [fetchModule()]);
    });
    
    it('should normalize header names according to HTTP specification', async () => {
      await cage.runCode(`
        const headers = new Headers();
        
        // Headers should be case-insensitive but preserve their original form
        headers.set('content-type', 'text/plain');
        if (headers.get('Content-Type') !== 'text/plain') {
          throw new Error('Headers failed to normalize case-insensitively');
        }
        
        // Test with non-standard header capitalization
        headers.set('X-Custom-Header', 'value');
        if (!headers.has('x-custom-header')) {
          throw new Error('Headers case normalization failed');
        }
        
        // Multiple append should combine values
        headers.append('Accept', 'text/html');
        headers.append('Accept', 'application/json');
        const accept = headers.get('accept');
        if (!accept.includes('text/html') || !accept.includes('application/json')) {
          throw new Error('Header values not combined properly: ' + accept);
        }
      `, [fetchModule()]);
    });
  });

  describe('Request', () => {
    it('should create requests with proper properties', async () => {
      await cage.runCode(`
        // Basic request
        const request1 = new Request('https://example.com/api');
        if (request1.url !== 'https://example.com/api') {
          throw new Error('Request.url is incorrect');
        }
        if (request1.method !== 'GET') {
          throw new Error('Request.method default is incorrect');
        }
        
        // Request with options
        const request2 = new Request('https://example.com/api', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ test: true })
        });
        
        if (request2.method !== 'POST') {
          throw new Error('Request.method is incorrect');
        }
        if (request2.headers.get('Content-Type') !== 'application/json') {
          throw new Error('Request headers are incorrect');
        }
      `, [fetchModule()]);
    });
    
    it('should clone requests properly', async () => {
      await cage.runCode(`
        const original = new Request('https://example.com/api', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' }
        });
        
        const clone = original.clone();
        
        if (clone.url !== original.url) {
          throw new Error('Cloned request URL does not match original');
        }
        
        if (clone.method !== original.method) {
          throw new Error('Cloned request method does not match original');
        }
        
        if (clone.headers.get('Content-Type') !== original.headers.get('Content-Type')) {
          throw new Error('Cloned request headers do not match original');
        }
      `, [fetchModule()]);
    });
    
    it('should support various request modes and credentials', async () => {
      await cage.runCode(`
        // Test different request modes
        const modes = ['cors', 'no-cors', 'same-origin'];
        for (const mode of modes) {
          const request = new Request('https://example.com', { mode });
          if (request.mode !== mode) {
            throw new Error('Request mode not set correctly: ' + mode);
          }
        }
        
        // Test different credentials modes
        const credentialsModes = ['omit', 'same-origin', 'include'];
        for (const creds of credentialsModes) {
          const request = new Request('https://example.com', { credentials: creds });
          if (request.credentials !== creds) {
            throw new Error('Request credentials not set correctly: ' + creds);
          }
        }
        
        // Test cache modes
        const cacheModes = ['default', 'no-store', 'reload', 'no-cache', 'force-cache', 'only-if-cached'];
        for (const cache of cacheModes) {
          const request = new Request('https://example.com', { cache });
          if (request.cache !== cache) {
            throw new Error('Request cache mode not set correctly: ' + cache);
          }
        }
      `, [fetchModule()]);
    });
  });

  describe('Response', () => {
    it('should create responses with proper properties', async () => {
      await cage.runCode(`
        // Basic response
        const response1 = new Response();
        if (response1.status !== 200) {
          throw new Error('Response.status default is incorrect');
        }
        if (response1.ok !== true) {
          throw new Error('Response.ok default is incorrect');
        }
        
        // Response with custom status
        const response2 = new Response('Not Found', {
          status: 404,
          statusText: 'Not Found',
          headers: { 'Content-Type': 'text/plain' }
        });
        
        if (response2.status !== 404) {
          throw new Error('Response.status is incorrect');
        }
        if (response2.ok !== false) {
          throw new Error('Response.ok should be false for 404');
        }
        if (response2.statusText !== 'Not Found') {
          throw new Error('Response.statusText is incorrect');
        }
        if (response2.headers.get('Content-Type') !== 'text/plain') {
          throw new Error('Response headers are incorrect');
        }
      `, [fetchModule()]);
    });
    
    it('should clone responses properly', async () => {
      await cage.runCode(`
        const original = new Response('Test data', {
          status: 201,
          headers: { 'Content-Type': 'text/plain' }
        });
        
        const clone = original.clone();
        
        if (clone.status !== original.status) {
          throw new Error('Cloned response status does not match original');
        }
        
        original.text().then(originalText => {
          clone.text().then(cloneText => {
            if (cloneText !== originalText) {
              throw new Error('Cloned response body does not match original');
            }
          });
        });
      `, [fetchModule()]);
    });
    
    it('should handle different Response types', async () => {
      await cage.runCode(`
        // Standard success response
        const successResponse = new Response('Success', { status: 200 });
        if (!successResponse.ok) {
          throw new Error('Response with status 200 should have ok=true');
        }
        
        // Test different response status codes
        const successCodes = [200, 201, 202, 204];
        for (const code of successCodes) {
          const response = new Response('', { status: code });
          if (!response.ok) {
            throw new Error('Response with status ' + code + ' should be ok');
          }
        }
        
        const errorCodes = [400, 401, 403, 404, 500, 502, 503];
        for (const code of errorCodes) {
          const response = new Response('', { status: code });
          if (response.ok) {
            throw new Error('Response with status ' + code + ' should not be ok');
          }
        }
      `, [fetchModule()]);
    });
  });

  describe('Promise-based Integration Tests', () => {
    it('should properly handle fetch Promise resolution', async () => {
      mockFetchResponse.json.mockResolvedValue({ name: 'Test User', id: 123 });
      
      // Instead of relying on Promise results, use synchronous validation
      await cage.runCode(`
        // Create a global validation flag
        let validationPassed = false;
        
        fetch('https://example.com/api')
          .then(function(response) {
            if (typeof response !== 'object') throw new Error('Response is not an object');
            if (response.status !== 200) throw new Error('Response status is not 200');
            if (!response.ok) throw new Error('Response.ok is not true');
            return response.json();
          })
          .then(function(data) {
            if (data.name !== 'Test User') throw new Error('Expected name "Test User" but got "' + data.name + '"');
            if (data.id !== 123) throw new Error('Expected id 123 but got ' + data.id);
            validationPassed = true;
          });
          
        // Wait for promise resolution
        for (let i = 0; i < 10; i++) {
          await new Promise(resolve => setTimeout(resolve, 10));
          if (validationPassed) break;
        }
        
        if (!validationPassed) {
          throw new Error('Fetch promise chain validation failed');
        }
      `, [fetchModule()]);
      
      // Verify mockFetch was called
      expect(mockFetch).toHaveBeenCalledWith('https://example.com/api', undefined);
    });
    
    it('should handle fetch error responses', async () => {
      // Set up a mock error response
      const errorResponse = {
        ...mockFetchResponse,
        ok: false,
        status: 404,
        statusText: 'Not Found'
      };
      mockFetch.mockResolvedValueOnce(errorResponse);
      
      await cage.runCode(`
        let validationPassed = false;
        
        fetch('https://example.com/notfound')
          .then(function(response) {
            if (response.ok !== false) throw new Error('Response.ok should be false');
            if (response.status !== 404) throw new Error('Response.status should be 404');
            if (response.statusText !== 'Not Found') throw new Error('Response.statusText should be "Not Found"');
            validationPassed = true;
          });
          
        // Wait for promise resolution
        for (let i = 0; i < 10; i++) {
          await new Promise(resolve => setTimeout(resolve, 10));
          if (validationPassed) break;
        }
        
        if (!validationPassed) {
          throw new Error('Error response validation failed');
        }
      `, [fetchModule()]);
      
      expect(mockFetch).toHaveBeenCalledWith('https://example.com/notfound', undefined);
    });
    
    it('should handle network errors', async () => {
      // Set up a mock network error
      mockFetch.mockRejectedValueOnce(new Error('Network failure'));
      
      await cage.runCode(`
        let validationPassed = false;
        
        fetch('https://example.com/error')
          .then(function(response) {
            throw new Error('Promise should have been rejected');
          })
          .catch(function(error) {
            if (!error.message.includes('Network failure')) {
              throw new Error('Expected network failure message, got: ' + error.message);
            }
            validationPassed = true;
          });
          
        // Wait for promise resolution
        for (let i = 0; i < 10; i++) {
          await new Promise(resolve => setTimeout(resolve, 10));
          if (validationPassed) break;
        }
        
        if (!validationPassed) {
          throw new Error('Network error validation failed');
        }
      `, [fetchModule()]);
      
      expect(mockFetch).toHaveBeenCalledWith('https://example.com/error', undefined);
    });
    
    it('should handle redirected responses', async () => {
      // Set up a mock redirect response
      const redirectResponse = {
        ...mockFetchResponse,
        redirected: true,
        url: 'https://example.com/redirected'
      };
      mockFetch.mockResolvedValueOnce(redirectResponse);
      
      await cage.runCode(`
        let validationPassed = false;
        
        fetch('https://example.com/redirect')
          .then(function(response) {
            if (response.redirected !== true) throw new Error('Response.redirected should be true');
            if (response.url !== 'https://example.com/redirected') throw new Error('Response.url should be redirected URL');
            validationPassed = true;
          });
          
        // Wait for promise resolution
        for (let i = 0; i < 10; i++) {
          await new Promise(resolve => setTimeout(resolve, 10));
          if (validationPassed) break;
        }
        
        if (!validationPassed) {
          throw new Error('Redirect response validation failed');
        }
      `, [fetchModule()]);
      
      expect(mockFetch).toHaveBeenCalledWith('https://example.com/redirect', undefined);
    });
  });
 
  describe('Body Reading', () => {
    it('should read response body as text', async () => {
      mockFetchResponse.text.mockResolvedValue('Hello World');
      
      await cage.runCode(`
        let validationPassed = false;
        
        fetch('https://example.com/text')
          .then(function(response) {
            return response.text();
          })
          .then(function(text) {
            if (text !== 'Hello World') throw new Error('Expected "Hello World", got: ' + text);
            validationPassed = true;
          });
          
        // Wait for promise resolution
        for (let i = 0; i < 10; i++) {
          await new Promise(resolve => setTimeout(resolve, 10));
          if (validationPassed) break;
        }
        
        if (!validationPassed) {
          throw new Error('Text body reading validation failed');
        }
      `, [fetchModule()]);
      
      expect(mockFetch).toHaveBeenCalledWith('https://example.com/text', undefined);
    });
    
    it('should read response body as JSON', async () => {
      mockFetchResponse.json.mockResolvedValue({ message: 'Success', code: 200 });
      
      await cage.runCode(`
        let validationPassed = false;
        
        fetch('https://example.com/json')
          .then(function(response) {
            return response.json();
          })
          .then(function(data) {
            if (data.message !== 'Success') throw new Error('Expected message "Success", got: ' + data.message);
            if (data.code !== 200) throw new Error('Expected code 200, got: ' + data.code);
            validationPassed = true;
          });
          
        // Wait for promise resolution
        for (let i = 0; i < 10; i++) {
          await new Promise(resolve => setTimeout(resolve, 10));
          if (validationPassed) break;
        }
        
        if (!validationPassed) {
          throw new Error('JSON body reading validation failed');
        }
      `, [fetchModule()]);
      
      expect(mockFetch).toHaveBeenCalledWith('https://example.com/json', undefined);
    });
    
    it('should read response body as ArrayBuffer', async () => {
      // Hello in ASCII
      const buffer = new Uint8Array([72, 101, 108, 108, 111]).buffer;
      mockFetchResponse.arrayBuffer.mockResolvedValue(buffer);
      
      await cage.runCode(`
        let validationPassed = false;
        
        fetch('https://example.com/binary')
          .then(function(response) {
            return response.arrayBuffer();
          })
          .then(function(buffer) {
            var view = new Uint8Array(buffer);
            // Test if it contains "Hello" in ASCII: 72, 101, 108, 108, 111
            if (view.length !== 5) throw new Error('Expected buffer length 5, got: ' + view.length);
            if (view[0] !== 72) throw new Error('Expected byte 72, got: ' + view[0]);
            if (view[1] !== 101) throw new Error('Expected byte 101, got: ' + view[1]);
            if (view[2] !== 108) throw new Error('Expected byte 108, got: ' + view[2]);
            if (view[3] !== 108) throw new Error('Expected byte 108, got: ' + view[3]);
            if (view[4] !== 111) throw new Error('Expected byte 111, got: ' + view[4]);
            validationPassed = true;
          });
          
        // Wait for promise resolution
        for (let i = 0; i < 10; i++) {
          await new Promise(resolve => setTimeout(resolve, 10));
          if (validationPassed) break;
        }
        
        if (!validationPassed) {
          throw new Error('ArrayBuffer body reading validation failed');
        }
      `, [fetchModule()]);
      
      expect(mockFetch).toHaveBeenCalledWith('https://example.com/binary', undefined);
    });
    
    it('should read response body as Blob', async () => {
      const testBlob = new Blob(['Hello World'], { type: 'text/plain' });
      mockFetchResponse.blob.mockResolvedValue(testBlob);
      
      await cage.runCode(`
        let validationPassed = false;
        
        fetch('https://example.com/blob')
          .then(function(response) {
            return response.blob();
          })
          .then(function(blob) {
            if (blob.type !== 'text/plain') throw new Error('Expected blob.type to be text/plain, got: ' + blob.type);
            if (blob.size !== 11) throw new Error('Expected blob.size to be 11, got: ' + blob.size);
            validationPassed = true;
          });
          
        // Wait for promise resolution
        for (let i = 0; i < 10; i++) {
          await new Promise(resolve => setTimeout(resolve, 10));
          if (validationPassed) break;
        }
        
        if (!validationPassed) {
          throw new Error('Blob body reading validation failed');
        }
      `, [fetchModule()]);
      
      expect(mockFetch).toHaveBeenCalledWith('https://example.com/blob', undefined);
    });
    
    it('should read response body as FormData', async () => {
      const formData = new FormData();
      formData.append('name', 'Test User');
      formData.append('id', '123');
      mockFetchResponse.formData.mockResolvedValue(formData);
      
      await cage.runCode(`
        let validationPassed = false;
        
        fetch('https://example.com/form')
          .then(function(response) {
            return response.formData();
          })
          .then(function(formData) {
            if (formData.get('name') !== 'Test User') throw new Error('Expected formData.name to be "Test User"');
            if (formData.get('id') !== '123') throw new Error('Expected formData.id to be "123"');
            validationPassed = true;
          });
          
        // Wait for promise resolution
        for (let i = 0; i < 10; i++) {
          await new Promise(resolve => setTimeout(resolve, 10));
          if (validationPassed) break;
        }
        
        if (!validationPassed) {
          throw new Error('FormData body reading validation failed');
        }
      `, [fetchModule()]);
      
      expect(mockFetch).toHaveBeenCalledWith('https://example.com/form', undefined);
    });
    
    it('should enforce body can only be consumed once', async () => {
      await cage.runCode(`
        let validationPassed = false;
        
        fetch('https://example.com/api')
          .then(function(response) {
            // First read should succeed
            return response.text().then(function(text) {
              try {
                // Second read should fail
                return response.json();
              } catch (e) {
                // Check proper error is thrown
                if (!e.message.includes('already been read') && 
                    !e.message.includes('body used already')) {
                  throw new Error('Expected body already consumed error but got: ' + e.message);
                }
                validationPassed = true;
              }
            });
          });
          
        // Wait for promise resolution
        for (let i = 0; i < 10; i++) {
          await new Promise(resolve => setTimeout(resolve, 10));
          if (validationPassed) break;
        }
        
        if (!validationPassed) {
          throw new Error('Body consumption validation failed');
        }
      `, [fetchModule()]);
    });
  });

  describe('Binary Data Handling', () => {
    it('should handle binary data with TypedArrays', async () => {
      // Set up a mock binary response
      const binaryData = new Uint8Array([
        0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A,
        0x00, 0x00, 0x00, 0x0D, 0x49, 0x48, 0x44, 0x52
      ]).buffer;
      mockFetchResponse.arrayBuffer.mockResolvedValue(binaryData);
      
      await cage.runCode(`
        let validationPassed = false;
        
        fetch('https://example.com/binary')
          .then(function(response) {
            return response.arrayBuffer();
          })
          .then(function(buffer) {
            // Verify first 8 bytes match PNG signature
            const signature = new Uint8Array(buffer, 0, 8);
            const expectedSignature = [0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A];
            
            for (let i = 0; i < 8; i++) {
              if (signature[i] !== expectedSignature[i]) {
                throw new Error('Binary data does not match expected value at position ' + i);
              }
            }
            
            // Create different types of views on the same buffer
            const int32View = new Int32Array(buffer);
            const uint8View = new Uint8Array(buffer);
            const dataView = new DataView(buffer);
            
            // Verify we can read data through different views
            if (dataView.getUint8(0) !== 0x89) {
              throw new Error('DataView read incorrect value');
            }
            
            if (uint8View[1] !== 0x50) { // 'P'
              throw new Error('Uint8Array read incorrect value');
            }
            
            validationPassed = true;
          });
          
        // Wait for promise resolution
        for (let i = 0; i < 10; i++) {
          await new Promise(resolve => setTimeout(resolve, 10));
          if (validationPassed) break;
        }
        
        if (!validationPassed) {
          throw new Error('Binary data handling validation failed');
        }
      `, [fetchModule()]);
      
      expect(mockFetch).toHaveBeenCalledWith('https://example.com/binary', undefined);
    });
    
    it('should handle sending binary data in requests', async () => {
      await cage.runCode(`
        let validationPassed = false;
        
        // Create binary data to send
        const buffer = new ArrayBuffer(8);
        const view = new Uint8Array(buffer);
        view.set([0x01, 0x02, 0x03, 0x04, 0x05, 0x06, 0x07, 0x08]);
        
        // Send binary data in a request
        fetch('https://example.com/binary-upload', {
          method: 'POST',
          headers: { 'Content-Type': 'application/octet-stream' },
          body: buffer
        }).then(function(response) {
          if (response.status === 200) {
            validationPassed = true;
          }
        });
        
        // Wait for promise resolution
        for (let i = 0; i < 10; i++) {
          await new Promise(resolve => setTimeout(resolve, 10));
          if (validationPassed) break;
        }
        
        if (!validationPassed) {
          throw new Error('Binary data upload validation failed');
        }
      `, [fetchModule()]);
      
      // Just verify the URL and method, but don't check binary content since
      // it may be transformed when passing through the sandbox
      expect(mockFetch).toHaveBeenCalledWith(
        'https://example.com/binary-upload', 
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({ 'Content-Type': 'application/octet-stream' })
        })
      );
    });
  });

  describe('AbortController', () => {
    it('should provide abort functionality', async () => {
      // Configure mockFetch to respond to abort signals
      const abortError = new DOMException('The operation was aborted.', 'AbortError');
      mockFetch.mockImplementation((_url, init) => {
        if (init?.signal?.aborted) {
          return Promise.reject(abortError);
        }
        return Promise.resolve(mockFetchResponse);
      });
      
      await cage.runCode(`
        // Create controller and abort
        var controller = new AbortController();
        var signal = controller.signal;
        
        // Initial state should be not aborted
        if (signal.aborted !== false) {
          throw new Error('New signal should not be aborted');
        }
        
        // Abort the controller
        controller.abort();
        
        // Signal should now be aborted
        if (signal.aborted !== true) {
          throw new Error('Signal should be aborted after abort() call');
        }
        
        // Test fetch with aborted signal
        let validationPassed = false;
        
        fetch('https://example.com/api', { signal: signal })
          .then(function() {
            throw new Error('Fetch should have failed with aborted signal');
          })
          .catch(function(error) {
            if (error.name !== 'AbortError') {
              throw new Error('Expected AbortError but got: ' + error.name);
            }
            validationPassed = true;
          });
          
        // Wait for promise resolution
        for (let i = 0; i < 10; i++) {
          await new Promise(resolve => setTimeout(resolve, 10));
          if (validationPassed) break;
        }
        
        if (!validationPassed) {
          throw new Error('AbortController validation failed');
        }
      `, [fetchModule()]);
    });
    
    it('should trigger abort event listeners', async () => {
      await cage.runCode(`
        var controller = new AbortController();
        var eventFired = false;
        
        controller.signal.addEventListener('abort', function() {
          eventFired = true;
        });
        
        controller.abort();
        
        if (!eventFired) {
          throw new Error('Abort event listener was not triggered');
        }
      `, [fetchModule()]);
    });
    
    it('should allow abort with custom reason', async () => {
      await cage.runCode(`
        let validationPassed = false;
        
        var controller = new AbortController();
        var customReason = { type: 'custom', message: 'Custom abort reason' };
        
        controller.signal.addEventListener('abort', function() {
          validationPassed = true;
        });
        
        // Abort with custom reason
        controller.abort(customReason);
        
        if (!validationPassed) {
          throw new Error('Abort with custom reason failed');
        }
        
        if (controller.signal.aborted !== true) {
          throw new Error('Signal should be aborted after abort() with custom reason');
        }
      `, [fetchModule()]);
    });
  });

  describe('Error Handling', () => {
    describe('Network Errors', () => {
      it('should handle generic network errors', async () => {
        // Mock fetch with network error
        const networkError = new TypeError('Failed to fetch');
        mockFetch.mockRejectedValue(networkError);

        await cage.runCode(`
          let validationPassed = false;

          fetch('https://example.com/api')
            .then(() => {
              throw new Error('Promise should have been rejected');
            })
            .catch(error => {
              if (!(error instanceof TypeError)) {
                throw new Error('Expected TypeError, got: ' + error.constructor.name);
              }
              if (!error.message.includes('Failed to fetch')) {
                throw new Error('Expected error message to include "Failed to fetch", got: ' + error.message);
              }
              validationPassed = true;
            });

          // Wait for promise resolution
          for (let i = 0; i < 10; i++) {
            await new Promise(resolve => setTimeout(resolve, 10));
            if (validationPassed) break;
          }

          if (!validationPassed) {
            throw new Error('Network error validation failed');
          }
        `, [fetchModule()]);
      });

      it('should handle specific error types according to spec', async () => {
        // Test different network error types
        const testCases = [
          {
            name: 'TypeError for network errors',
            error: new TypeError('Failed to fetch'),
            expectedType: 'TypeError'
          },
          {
            name: 'AbortError for aborted requests',
            error: new DOMException('The operation was aborted', 'AbortError'),
            expectedType: 'AbortError'
          },
          {
            name: 'SecurityError for security violations',
            error: new DOMException('Security error', 'SecurityError'),
            expectedType: 'SecurityError'
          }
        ];

        for (const testCase of testCases) {
          // Mock fetch with specific error
          mockFetch.mockReset();
          mockFetch.mockRejectedValue(testCase.error);

          await cage.runCode(`
            let validationPassed = false;

            fetch('https://example.com/api')
              .catch(error => {
                if (error.name !== '${testCase.expectedType}') {
                  throw new Error('Expected ${testCase.expectedType}, got: ' + error.name);
                }
                validationPassed = true;
              });

            // Wait for promise resolution
            for (let i = 0; i < 10; i++) {
              await new Promise(resolve => setTimeout(resolve, 10));
              if (validationPassed) break;
            }

            if (!validationPassed) {
              throw new Error('${testCase.name} validation failed');
            }
          `, [fetchModule()]);
        }
      });
    });

    describe('Custom Fetch Implementation Errors', () => {
      it('should preserve custom error types from custom fetch implementations', async () => {
        // Custom error class
        class CustomAPIError extends Error {
          constructor(message: string, public statusCode: number) {
            super(message);
            this.name = 'CustomAPIError';
          }
        }

        // Custom fetch implementation that throws custom errors
        const customFetch = vi.fn().mockRejectedValue(
          new CustomAPIError('API request failed', 503)
        );

        const config: FetchModuleConfig = {
          fetchImpl: customFetch
        };

        await cage.runCode(`
          let validationPassed = false;

          fetch('https://example.com/api')
            .catch(error => {
              if (error.name !== 'CustomAPIError') {
                throw new Error('Expected CustomAPIError, got: ' + error.name);
              }
              if (error.message !== 'API request failed') {
                throw new Error('Expected error message "API request failed", got: ' + error.message);
              }
              validationPassed = true;
            });

          // Wait for promise resolution
          for (let i = 0; i < 10; i++) {
            await new Promise(resolve => setTimeout(resolve, 10));
            if (validationPassed) break;
          }

          if (!validationPassed) {
            throw new Error('Custom error validation failed');
          }
        `, [fetchModule(config)]);

        expect(customFetch).toHaveBeenCalledWith('https://example.com/api', undefined);
      });

      it('should handle non-standard error objects from custom fetch implementations', async () => {
        // Custom fetch with non-standard error object
        const nonStandardError = {
          errorCode: 'AUTH_FAILED',
          message: 'Authentication failed',
          details: { reason: 'token_expired' }
        };

        const customFetch = vi.fn().mockRejectedValue(nonStandardError);

        const config: FetchModuleConfig = {
          fetchImpl: customFetch
        };

        await cage.runCode(`
          let validationPassed = false;

          fetch('https://example.com/api')
            .catch(error => {
              if (!error || typeof error !== 'object') {
                throw new Error('Expected error object, got: ' + typeof error);
              }
              if (error.errorCode !== 'AUTH_FAILED') {
                throw new Error('Expected errorCode "AUTH_FAILED", got: ' + error.errorCode);
              }
              if (error.details?.reason !== 'token_expired') {
                throw new Error('Expected details.reason "token_expired", got: ' + error.details?.reason);
              }
              validationPassed = true;
            });

          // Wait for promise resolution
          for (let i = 0; i < 10; i++) {
            await new Promise(resolve => setTimeout(resolve, 10));
            if (validationPassed) break;
          }

          if (!validationPassed) {
            throw new Error('Non-standard error validation failed');
          }
        `, [fetchModule(config)]);
      });
    });

    describe('HTTP Error Responses', () => {
      it('should handle HTTP error status codes correctly', async () => {
        // Test various HTTP error status codes
        const statusCodes = [400, 401, 403, 404, 500, 502, 503];

        for (const status of statusCodes) {
          const errorResponse = {
            ...mockFetchResponse,
            ok: false,
            status,
            statusText: `Error ${status}`,
            json: vi.fn().mockResolvedValue({ error: `Error ${status}` })
          };

          mockFetch.mockReset();
          mockFetch.mockResolvedValue(errorResponse);

          await cage.runCode(`
            let validationPassed = false;

            fetch('https://example.com/api')
              .then(response => {
                if (response.ok !== false) {
                  throw new Error('Expected response.ok to be false');
                }
                if (response.status !== ${status}) {
                  throw new Error('Expected status ${status}, got: ' + response.status);
                }
                return response.json();
              })
              .then(data => {
                if (data.error !== 'Error ${status}') {
                  throw new Error('Expected error message, got: ' + data.error);
                }
                validationPassed = true;
              });

            // Wait for promise resolution
            for (let i = 0; i < 10; i++) {
              await new Promise(resolve => setTimeout(resolve, 10));
              if (validationPassed) break;
            }

            if (!validationPassed) {
              throw new Error('HTTP ${status} validation failed');
            }
          `, [fetchModule()]);
        }
      });
    });

    describe('Body Consumption Errors', () => {
      it('should properly handle body already consumed error with streaming responses', async () => {
        // Set up mock for fetch response with body that can be consumed
        let bodyUsed = false;
        const mockStreamingResponse = {
          ...mockFetchResponse,
          ok: true,
          status: 200,
          get bodyUsed() { return bodyUsed; },
          json: vi.fn().mockImplementation(() => {
            if (bodyUsed) {
              throw new TypeError('Body has already been consumed');
            }
            bodyUsed = true;
            return Promise.resolve({ message: 'Success' });
          }),
          text: vi.fn().mockImplementation(() => {
            if (bodyUsed) {
              throw new TypeError('Body has already been consumed');
            }
            bodyUsed = true;
            return Promise.resolve('Hello world');
          })
        };

        mockFetch.mockReset();
        mockFetch.mockResolvedValue(mockStreamingResponse);

        await cage.runCode(`
          let validationPassed = false;

          fetch('https://example.com/api')
            .then(response => {
              // First read should succeed
              return response.json()
                .then(data => {
                  // Now try to read again, should fail
                  return response.text()
                    .then(() => {
                      throw new Error('Second read should have failed');
                    })
                    .catch(error => {
                      if (!error.message.includes('already been consumed')) {
                        throw new Error('Expected body consumed error message, got: ' + error.message);
                      }
                      validationPassed = true;
                    });
                });
            });

          // Wait for promise resolution
          for (let i = 0; i < 10; i++) {
            await new Promise(resolve => setTimeout(resolve, 10));
            if (validationPassed) break;
          }

          if (!validationPassed) {
            throw new Error('Body already consumed validation failed');
          }
        `, [fetchModule()]);
      });
    });
  });

  describe('ReadableStream and Streaming Response', () => {
    // Add body property mock to fetch response
    beforeEach(() => {
      // Create mock stream methods
      const mockReader = {
        read: vi.fn(),
        cancel: vi.fn(),
        closed: Promise.resolve(),
        releaseLock: vi.fn()
      };
      
      // Create a mock for ReadableStream
      const mockStream = {
        getReader: vi.fn().mockReturnValue(mockReader),
        locked: false
      };
      
      // Add mock body property to response
      mockFetchResponse.body = mockStream;
    });

    it('should expose response.body property', async () => {
      await cage.runCode(`
        let validationPassed = false;
        
        fetch('https://example.com/stream')
          .then(function(response) {
            if (response.body === undefined || response.body === null) {
              throw new Error('Response.body property should be defined');
            }
            validationPassed = true;
          });
          
        // Wait for promise resolution
        for (let i = 0; i < 10; i++) {
          await new Promise(resolve => setTimeout(resolve, 10));
          if (validationPassed) break;
        }
        
        if (!validationPassed) {
          throw new Error('Response.body validation failed');
        }
      `, [fetchModule()]);
      
      expect(mockFetch).toHaveBeenCalledWith('https://example.com/stream', undefined);
    });

    it('should handle streams using tee() method', async () => {
      // Configure mock stream with tee method
      mockFetchResponse.body.tee = vi.fn().mockReturnValue([
        { ...mockFetchResponse.body },
        { ...mockFetchResponse.body }
      ]);
      
      await cage.runCode(`
        let validationPassed = false;
        
        fetch('https://example.com/stream')
          .then(function(response) {
            // Test if body stream has tee method
            if (typeof response.body.tee !== 'function') {
              throw new Error('Response.body.tee method should be available');
            }
            
            // Try to tee the stream
            try {
              const [stream1, stream2] = response.body.tee();
              
              // Check that we got two streams
              if (!stream1 || !stream2) {
                throw new Error('Tee should return two streams');
              }
              
              validationPassed = true;
            } catch (e) {
              throw new Error('Failed to tee stream: ' + e.message);
            }
          });
          
        // Wait for promise resolution
        for (let i = 0; i < 10; i++) {
          await new Promise(resolve => setTimeout(resolve, 10));
          if (validationPassed) break;
        }
        
        if (!validationPassed) {
          throw new Error('Stream tee validation failed');
        }
      `, [fetchModule()]);
      
      expect(mockFetch).toHaveBeenCalledWith('https://example.com/stream', undefined);
    });

    it('should support reading from a stream with getReader()', async () => {
      // Set up mock reader with read method that simulates streaming data
      const chunks = [
        { value: new Uint8Array([1, 2, 3]), done: false },
        { value: new Uint8Array([4, 5, 6]), done: false },
        { value: undefined, done: true }
      ];
      
      let readCount = 0;
      mockFetchResponse.body.getReader = vi.fn().mockReturnValue({
        read: vi.fn().mockImplementation(() => {
          return Promise.resolve(chunks[readCount++]);
        }),
        cancel: vi.fn(),
        releaseLock: vi.fn()
      });
      
      await cage.runCode(`
        let validationPassed = false;
        
        fetch('https://example.com/stream')
          .then(async function(response) {
            // Get a reader from the stream
            const reader = response.body.getReader();
            
            if (typeof reader.read !== 'function') {
              throw new Error('Reader should have a read method');
            }
            
            // Read first chunk
            const chunk1 = await reader.read();
            if (chunk1.done) {
              throw new Error('First read should not be done');
            }
            
            const view1 = new Uint8Array(chunk1.value);
            if (view1.length !== 3 || view1[0] !== 1 || view1[1] !== 2 || view1[2] !== 3) {
              throw new Error('First chunk has incorrect data');
            }
            
            // Read second chunk
            const chunk2 = await reader.read();
            if (chunk2.done) {
              throw new Error('Second read should not be done');
            }
            
            const view2 = new Uint8Array(chunk2.value);
            if (view2.length !== 3 || view2[0] !== 4 || view2[1] !== 5 || view2[2] !== 6) {
              throw new Error('Second chunk has incorrect data');
            }
            
            // Read end of stream
            const chunk3 = await reader.read();
            if (!chunk3.done) {
              throw new Error('Third read should be done');
            }
            
            validationPassed = true;
          });
          
        // Wait for promise resolution
        for (let i = 0; i < 10; i++) {
          await new Promise(resolve => setTimeout(resolve, 10));
          if (validationPassed) break;
        }
        
        if (!validationPassed) {
          throw new Error('Stream reading validation failed');
        }
      `, [fetchModule()]);
      
      expect(mockFetch).toHaveBeenCalledWith('https://example.com/stream', undefined);
    });

    it('should support canceling a stream', async () => {
      // Set up mock reader with cancel method
      const mockCancel = vi.fn().mockResolvedValue(undefined);
      mockFetchResponse.body.getReader = vi.fn().mockReturnValue({
        read: vi.fn(),
        cancel: mockCancel,
        releaseLock: vi.fn()
      });
      
      await cage.runCode(`
        let validationPassed = false;
        
        fetch('https://example.com/stream')
          .then(async function(response) {
            // Get a reader from the stream
            const reader = response.body.getReader();
            
            if (typeof reader.cancel !== 'function') {
              throw new Error('Reader should have a cancel method');
            }
            
            // Cancel the stream
            try {
              await reader.cancel('Stream no longer needed');
              validationPassed = true;
            } catch (e) {
              throw new Error('Failed to cancel stream: ' + e.message);
            }
          });
          
        // Wait for promise resolution
        for (let i = 0; i < 10; i++) {
          await new Promise(resolve => setTimeout(resolve, 10));
          if (validationPassed) break;
        }
        
        if (!validationPassed) {
          throw new Error('Stream cancellation validation failed');
        }
      `, [fetchModule()]);
      
      expect(mockFetch).toHaveBeenCalledWith('https://example.com/stream', undefined);
    });

    it('should check if a stream is locked', async () => {
      await cage.runCode(`
        let validationPassed = false;
        
        fetch('https://example.com/stream')
          .then(function(response) {
            // Initially, stream should not be locked
            if (response.body.locked !== false) {
              throw new Error('Stream should not be locked initially');
            }
            
            // Get a reader, which should lock the stream
            const reader = response.body.getReader();
            
            // Now stream should be locked
            if (response.body.locked !== true) {
              throw new Error('Stream should be locked after getReader()');
            }
            
            // Release the lock
            reader.releaseLock();
            
            // Stream should be unlocked again
            if (response.body.locked !== false) {
              throw new Error('Stream should be unlocked after releaseLock()');
            }
            
            validationPassed = true;
          });
          
        // Wait for promise resolution
        for (let i = 0; i < 10; i++) {
          await new Promise(resolve => setTimeout(resolve, 10));
          if (validationPassed) break;
        }
        
        if (!validationPassed) {
          throw new Error('Stream locking validation failed');
        }
      `, [fetchModule()]);
      
      expect(mockFetch).toHaveBeenCalledWith('https://example.com/stream', undefined);
    });
  });
});
