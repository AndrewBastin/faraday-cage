// TextEncoder and TextDecoder polyfill for QuickJS
// This provides the WHATWG Encoding Standard API by bridging to the host environment

(function(
  hostTextEncoderEncode,
  hostTextEncoderEncodeInto,
  hostTextDecoderCreate,
  hostTextDecoderDecode
) {
  'use strict';

  // TextEncoder implementation
  function TextEncoder() {
    // TextEncoder only supports UTF-8
  }

  TextEncoder.prototype.encode = function(input) {
    if (input === undefined) input = '';
    const str = String(input);
    // Call the bridge function to the host TextEncoder
    return hostTextEncoderEncode(str);
  };

  TextEncoder.prototype.encodeInto = function(source, destination) {
    if (source === undefined) source = '';
    if (!(destination instanceof Uint8Array)) {
      throw new TypeError("Failed to execute 'encodeInto' on 'TextEncoder': parameter 2 is not of type 'Uint8Array'.");
    }
    const str = String(source);
    // Call the bridge function to the host TextEncoder
    return hostTextEncoderEncodeInto(str, destination);
  };

  // Define encoding property
  Object.defineProperty(TextEncoder.prototype, 'encoding', {
    value: 'utf-8',
    writable: false,
    enumerable: true,
    configurable: false
  });

  // TextDecoder implementation
  function TextDecoder(label, options) {
    if (label === undefined) label = 'utf-8';
    if (options === undefined) options = {};

    const normalizedLabel = normalizeEncoding(String(label));
    const fatal = Boolean(options.fatal);
    const ignoreBOM = Boolean(options.ignoreBOM);

    // Create a decoder instance via the bridge
    const decoderId = hostTextDecoderCreate(normalizedLabel, fatal, ignoreBOM);
    
    // Store the decoder configuration
    this.__decoderId = decoderId;
    this.__encoding = normalizedLabel;
    this.__fatal = fatal;
    this.__ignoreBOM = ignoreBOM;
  }

  TextDecoder.prototype.decode = function(input, options) {
    if (options === undefined) options = {};
    const stream = Boolean(options.stream);
    
    // Call the bridge function to the host TextDecoder
    return hostTextDecoderDecode(this.__decoderId, input, stream);
  };

  // Define properties
  Object.defineProperty(TextDecoder.prototype, 'encoding', {
    get: function() { return this.__encoding; },
    enumerable: true,
    configurable: false
  });

  Object.defineProperty(TextDecoder.prototype, 'fatal', {
    get: function() { return this.__fatal; },
    enumerable: true,
    configurable: false
  });

  Object.defineProperty(TextDecoder.prototype, 'ignoreBOM', {
    get: function() { return this.__ignoreBOM; },
    enumerable: true,
    configurable: false
  });

  // Helper function to normalize encoding labels
  function normalizeEncoding(label) {
    if (!label) return 'utf-8';
    
    const normalized = label.toLowerCase().trim();
    
    // Common UTF-8 labels
    const utf8Labels = [
      'utf-8', 'utf8', 'unicode-1-1-utf-8'
    ];
    
    if (utf8Labels.includes(normalized)) {
      return 'utf-8';
    }
    
    // Return as-is for validation by the host
    return normalized;
  }

  // Make TextEncoder and TextDecoder available globally
  globalThis.TextEncoder = TextEncoder;
  globalThis.TextDecoder = TextDecoder;
})
