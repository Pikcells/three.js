/*
  Modified by George Fuller on behalf of Pikcells ltd.
  Format now handleing parsing of a json controlled binary file,
  the bin format is based on ctm but with some stuff stripped out,
  the parsing technique is slightly different, this wasn't intentional. 
  I just wasn't able to replicate the technique for building ctm perfectly.
*/


/*
Copyright (c) 2011 Juan Mellado
Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:
The above copyright notice and this permission notice shall be included in
all copies or substantial portions of the Software.
THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
THE SOFTWARE.
*/

/*
References:
- "OpenCTM: The Open Compressed Triangle Mesh file format" by Marcus Geelnard
  http://openctm.sourceforge.net/
*/

window.LegacyTextEncoder = null;

(function(global) {
  'use strict';

  if (typeof module !== "undefined" && module.exports) {
    module.exports = global;
  }

  global["encoding-indexes"] =
{
 "windows-1252":[8364,129,8218,402,8222,8230,8224,8225,710,8240,352,8249,338,141,381,143,144,8216,8217,8220,8221,8226,8211,8212,732,8482,353,8250,339,157,382,376,160,161,162,163,164,165,166,167,168,169,170,171,172,173,174,175,176,177,178,179,180,181,182,183,184,185,186,187,188,189,190,191,192,193,194,195,196,197,198,199,200,201,202,203,204,205,206,207,208,209,210,211,212,213,214,215,216,217,218,219,220,221,222,223,224,225,226,227,228,229,230,231,232,233,234,235,236,237,238,239,240,241,242,243,244,245,246,247,248,249,250,251,252,253,254,255],
};

// For strict environments where `this` inside the global scope
// is `undefined`, take a pure object instead
}(this || {}));

// This is free and unencumbered software released into the public domain.
// See LICENSE.md for more information.

/**
 * @fileoverview Global |this| required for resolving indexes in node.
 * @suppress {globalThis}
 */
(function(global) {
  'use strict';

  // If we're in node require encoding-indexes and attach it to the global.
  if (typeof module !== "undefined" && module.exports &&
    !global["encoding-indexes"]) {
    global["encoding-indexes"] =
      require("./encoding-indexes.js")["encoding-indexes"];
  }

  //
  // Utilities
  //

  /**
   * @param {number} a The number to test.
   * @param {number} min The minimum value in the range, inclusive.
   * @param {number} max The maximum value in the range, inclusive.
   * @return {boolean} True if a >= min and a <= max.
   */
  function inRange(a, min, max) {
    return min <= a && a <= max;
  }

  /**
   * @param {!Array.<*>} array The array to check.
   * @param {*} item The item to look for in the array.
   * @return {boolean} True if the item appears in the array.
   */
  function includes(array, item) {
    return array.indexOf(item) !== -1;
  }

  var floor = Math.floor;

  /**
   * @param {*} o
   * @return {Object}
   */
  function ToDictionary(o) {
    if (o === undefined) return {};
    if (o === Object(o)) return o;
    throw TypeError('Could not convert argument to dictionary');
  }

  /**
   * @param {string} string Input string of UTF-16 code units.
   * @return {!Array.<number>} Code points.
   */
  function stringToCodePoints(string) {
    // https://heycam.github.io/webidl/#dfn-obtain-unicode

    // 1. Let S be the DOMString value.
    var s = String(string);

    // 2. Let n be the length of S.
    var n = s.length;

    // 3. Initialize i to 0.
    var i = 0;

    // 4. Initialize U to be an empty sequence of Unicode characters.
    var u = [];

    // 5. While i < n:
    while (i < n) {

      // 1. Let c be the code unit in S at index i.
      var c = s.charCodeAt(i);

      // 2. Depending on the value of c:

      // c < 0xD800 or c > 0xDFFF
      if (c < 0xD800 || c > 0xDFFF) {
        // Append to U the Unicode character with code point c.
        u.push(c);
      }

      // 0xDC00 ≤ c ≤ 0xDFFF
      else if (0xDC00 <= c && c <= 0xDFFF) {
        // Append to U a U+FFFD REPLACEMENT CHARACTER.
        u.push(0xFFFD);
      }

      // 0xD800 ≤ c ≤ 0xDBFF
      else if (0xD800 <= c && c <= 0xDBFF) {
        // 1. If i = n−1, then append to U a U+FFFD REPLACEMENT
        // CHARACTER.
        if (i === n - 1) {
          u.push(0xFFFD);
        }
        // 2. Otherwise, i < n−1:
        else {
          // 1. Let d be the code unit in S at index i+1.
          var d = s.charCodeAt(i + 1);

          // 2. If 0xDC00 ≤ d ≤ 0xDFFF, then:
          if (0xDC00 <= d && d <= 0xDFFF) {
            // 1. Let a be c & 0x3FF.
            var a = c & 0x3FF;

            // 2. Let b be d & 0x3FF.
            var b = d & 0x3FF;

            // 3. Append to U the Unicode character with code point
            // 2^16+2^10*a+b.
            u.push(0x10000 + (a << 10) + b);

            // 4. Set i to i+1.
            i += 1;
          }

          // 3. Otherwise, d < 0xDC00 or d > 0xDFFF. Append to U a
          // U+FFFD REPLACEMENT CHARACTER.
          else  {
            u.push(0xFFFD);
          }
        }
      }

      // 3. Set i to i+1.
      i += 1;
    }

    // 6. Return U.
    return u;
  }

  /**
   * @param {!Array.<number>} code_points Array of code points.
   * @return {string} string String of UTF-16 code units.
   */
  function codePointsToString(code_points) {
    var s = '';
    for (var i = 0; i < code_points.length; ++i) {
      var cp = code_points[i];
      if (cp <= 0xFFFF) {
        s += String.fromCharCode(cp);
      } else {
        cp -= 0x10000;
        s += String.fromCharCode((cp >> 10) + 0xD800,
                                 (cp & 0x3FF) + 0xDC00);
      }
    }
    return s;
  }


  //
  // Implementation of Encoding specification
  // https://encoding.spec.whatwg.org/
  //

  //
  // 4. Terminology
  //

  /**
   * An ASCII byte is a byte in the range 0x00 to 0x7F, inclusive.
   * @param {number} a The number to test.
   * @return {boolean} True if a is in the range 0x00 to 0x7F, inclusive.
   */
  function isASCIIByte(a) {
    return 0x00 <= a && a <= 0x7F;
  }

  /**
   * An ASCII code point is a code point in the range U+0000 to
   * U+007F, inclusive.
   */
  var isASCIICodePoint = isASCIIByte;


  /**
   * End-of-stream is a special token that signifies no more tokens
   * are in the stream.
   * @const
   */ var end_of_stream = -1;

  /**
   * A stream represents an ordered sequence of tokens.
   *
   * @constructor
   * @param {!(Array.<number>|Uint8Array)} tokens Array of tokens that provide
   * the stream.
   */
  function Stream(tokens) {
    /** @type {!Array.<number>} */
    this.tokens = [].slice.call(tokens);
    // Reversed as push/pop is more efficient than shift/unshift.
    this.tokens.reverse();
  }

  Stream.prototype = {
    /**
     * @return {boolean} True if end-of-stream has been hit.
     */
    endOfStream: function() {
      return !this.tokens.length;
    },

    /**
     * When a token is read from a stream, the first token in the
     * stream must be returned and subsequently removed, and
     * end-of-stream must be returned otherwise.
     *
     * @return {number} Get the next token from the stream, or
     * end_of_stream.
     */
     read: function() {
      if (!this.tokens.length)
        return end_of_stream;
       return this.tokens.pop();
     },

    /**
     * When one or more tokens are prepended to a stream, those tokens
     * must be inserted, in given order, before the first token in the
     * stream.
     *
     * @param {(number|!Array.<number>)} token The token(s) to prepend to the
     * stream.
     */
    prepend: function(token) {
      if (Array.isArray(token)) {
        var tokens = /**@type {!Array.<number>}*/(token);
        while (tokens.length)
          this.tokens.push(tokens.pop());
      } else {
        this.tokens.push(token);
      }
    },

    /**
     * When one or more tokens are pushed to a stream, those tokens
     * must be inserted, in given order, after the last token in the
     * stream.
     *
     * @param {(number|!Array.<number>)} token The tokens(s) to push to the
     * stream.
     */
    push: function(token) {
      if (Array.isArray(token)) {
        var tokens = /**@type {!Array.<number>}*/(token);
        while (tokens.length)
          this.tokens.unshift(tokens.shift());
      } else {
        this.tokens.unshift(token);
      }
    }
  };

  //
  // 5. Encodings
  //

  /** @const */
  var finished = -1;

  /**
   * @param {number} code_point The code point that could not be encoded.
   * @return {number} Always throws, no value is actually returned.
   */
  function encoderError(code_point) {
    throw TypeError('The code point ' + code_point + ' could not be encoded.');
  }

  /** @interface */
  function Encoder() {}
  Encoder.prototype = {
    /**
     * @param {Stream} stream The stream of code points being encoded.
     * @param {number} code_point Next code point read from the stream.
     * @return {(number|!Array.<number>)} Byte(s) to emit, or |finished|.
     */
    handler: function(stream, code_point) {}
  };

  // 5.2 Names and labels

  // TODO: Define @typedef for Encoding: {name:string,labels:Array.<string>}
  // https://github.com/google/closure-compiler/issues/247

  /**
   * @param {string} label The encoding label.
   * @return {?{name:string,labels:Array.<string>}}
   */
  function getEncoding(label) {
    // 1. Remove any leading and trailing ASCII whitespace from label.
    label = String(label).trim().toLowerCase();

    // 2. If label is an ASCII case-insensitive match for any of the
    // labels listed in the table below, return the corresponding
    // encoding, and failure otherwise.
    if (Object.prototype.hasOwnProperty.call(label_to_encoding, label)) {
      return label_to_encoding[label];
    }
    return null;
  }

  /**
   * Encodings table: https://encoding.spec.whatwg.org/encodings.json
   * @const
   * @type {!Array.<{
   *          heading: string,
   *          encodings: Array.<{name:string,labels:Array.<string>}>
   *        }>}
   */
  var encodings = [
    {
      "encodings": [
        {
          "labels": [
            "windows-1252"
          ],
          "name": "windows-1252"
        },
      ],
      "heading": "Legacy single-byte encodings"
    }
  ];

  // Label to encoding registry.
  /** @type {Object.<string,{name:string,labels:Array.<string>}>} */
  var label_to_encoding = {};
  encodings.forEach(function(category) {
    category.encodings.forEach(function(encoding) {
      encoding.labels.forEach(function(label) {
        label_to_encoding[label] = encoding;
      });
    });
  });

  // Registry of of encoder/decoder factories, by encoding name.
  /** @type {Object.<string, function({fatal:boolean}): Encoder>} */
  var encoders = {};

  //
  // 6. Indexes
  //

  /**
   * @param {number} pointer The |pointer| to search for.
   * @param {(!Array.<?number>|undefined)} index The |index| to search within.
   * @return {?number} The code point corresponding to |pointer| in |index|,
   *     or null if |code point| is not in |index|.
   */
  function indexCodePointFor(pointer, index) {
    if (!index) return null;
    return index[pointer] || null;
  }

  /**
   * @param {number} code_point The |code point| to search for.
   * @param {!Array.<?number>} index The |index| to search within.
   * @return {?number} The first pointer corresponding to |code point| in
   *     |index|, or null if |code point| is not in |index|.
   */
  function indexPointerFor(code_point, index) {
    var pointer = index.indexOf(code_point);
    return pointer === -1 ? null : pointer;
  }

  /**
   * @param {string} name Name of the index.
   * @return {(!Array.<number>|!Array.<Array.<number>>)}
   *  */
  function index(name) {
    if (!('encoding-indexes' in global)) {
      throw Error("Indexes missing." +
                  " Did you forget to include encoding-indexes.js first?");
    }
    return global['encoding-indexes'][name];
  }

  // 8.2 Interface LegacyTextEncoder

  /**
   * @constructor
   * @param {string=} label The label of the encoding. NONSTANDARD.
   * @param {Object=} options NONSTANDARD.
   */
  function LegacyTextEncoder(label, options) {
    // Web IDL conventions
    if (!(this instanceof LegacyTextEncoder))
      throw TypeError('Called as a function. Did you forget \'new\'?');
    options = ToDictionary(options);

    // A LegacyTextEncoder object has an associated encoding and encoder.

    /** @private */
    this._encoding = null;
    /** @private @type {?Encoder} */
    this._encoder = null;

    // Non-standard
    /** @private @type {boolean} */
    this._do_not_flush = false;
    /** @private @type {string} */
    this._fatal = Boolean(options['fatal']) ? 'fatal' : 'replacement';

    // 1. Let enc be a new LegacyTextEncoder object.
    var enc = this;

    // 2. Set enc's encoding to UTF-8's encoder.
    if (Boolean(options['NONSTANDARD_allowLegacyEncoding'])) {
      // NONSTANDARD behavior.
      label = label !== undefined ? String(label) : DEFAULT_ENCODING;
      var encoding = getEncoding(label);
      if (encoding === null || encoding.name === 'replacement')
        throw RangeError('Unknown encoding: ' + label);
      if (!encoders[encoding.name]) {
        throw Error('Encoder not present.' +
                    ' Did you forget to include encoding-indexes.js first?');
      }
      enc._encoding = encoding;
    } else {
      // Standard behavior.
      enc._encoding = getEncoding('utf-8');

      if (label !== undefined && 'console' in global) {
        console.warn('LegacyTextEncoder constructor called with encoding label, '
                     + 'which is ignored.');
      }
    }

    // For pre-ES5 runtimes:
    if (!Object.defineProperty)
      this.encoding = enc._encoding.name.toLowerCase();

    // 3. Return enc.
    return enc;
  }

  if (Object.defineProperty) {
    // The encoding attribute's getter must return encoding's name.
    Object.defineProperty(LegacyTextEncoder.prototype, 'encoding', {
      /** @this {LegacyTextEncoder} */
      get: function() { return this._encoding.name.toLowerCase(); }
    });
  }

  /**
   * @param {string=} opt_string The string to encode.
   * @param {Object=} options
   * @return {!Uint8Array} Encoded bytes, as a Uint8Array.
   */
  LegacyTextEncoder.prototype.encode = function encode(opt_string, options) {
    opt_string = opt_string === undefined ? '' : String(opt_string);
    options = ToDictionary(options);

    // NOTE: This option is nonstandard. None of the encodings
    // permitted for encoding (i.e. UTF-8, UTF-16) are stateful when
    // the input is a USVString so streaming is not necessary.
    if (!this._do_not_flush)
      this._encoder = encoders[this._encoding.name]({
        fatal: this._fatal === 'fatal'});
    this._do_not_flush = Boolean(options['stream']);

    // 1. Convert input to a stream.
    var input = new Stream(stringToCodePoints(opt_string));

    // 2. Let output be a new stream
    var output = [];

    /** @type {?(number|!Array.<number>)} */
    var result;
    // 3. While true, run these substeps:
    while (true) {
      // 1. Let token be the result of reading from input.
      var token = input.read();
      if (token === end_of_stream)
        break;
      // 2. Let result be the result of processing token for encoder,
      // input, output.
      result = this._encoder.handler(input, token);
      if (result === finished)
        break;
      if (Array.isArray(result))
        output.push.apply(output, /**@type {!Array.<number>}*/(result));
      else
        output.push(result);
    }
    // TODO: Align with spec algorithm.
    if (!this._do_not_flush) {
      while (true) {
        result = this._encoder.handler(input, input.read());
        if (result === finished)
          break;
        if (Array.isArray(result))
          output.push.apply(output, /**@type {!Array.<number>}*/(result));
        else
          output.push(result);
      }
      this._encoder = null;
    }
    // 3. If result is finished, convert output into a byte sequence,
    // and then return a Uint8Array object wrapping an ArrayBuffer
    // containing output.
    return new Uint8Array(output);
  };

  // 10.2 single-byte encoder
  /**
   * @constructor
   * @implements {Encoder}
   * @param {!Array.<?number>} index The encoding index.
   * @param {{fatal: boolean}} options
   */
  function SingleByteEncoder(index, options) {
    var fatal = options.fatal;
    /**
     * @param {Stream} stream Input stream.
     * @param {number} code_point Next code point read from the stream.
     * @return {(number|!Array.<number>)} Byte(s) to emit.
     */
    this.handler = function(stream, code_point) {
      // 1. If code point is end-of-stream, return finished.
      if (code_point === end_of_stream)
        return finished;

      // 2. If code point is an ASCII code point, return a byte whose
      // value is code point.
      if (isASCIICodePoint(code_point))
        return code_point;

      // 3. Let pointer be the index pointer for code point in index
      // single-byte.
      var pointer = indexPointerFor(code_point, index);

      // 4. If pointer is null, return error with code point.
      if (pointer === null)
        encoderError(code_point);

      // 5. Return a byte whose value is pointer + 0x80.
      return pointer + 0x80;
    };
  }

  (function() {
    if (!('encoding-indexes' in global))
      return;
    encodings.forEach(function(category) {
      if (category.heading !== 'Legacy single-byte encodings')
        return;
      category.encodings.forEach(function(encoding) {
        var name = encoding.name;
        var idx = index(name.toLowerCase());
        /** @param {{fatal: boolean}} options */
        /** @param {{fatal: boolean}} options */
        encoders[name] = function(options) {
          return new SingleByteEncoder(idx, options);
        };
      });
    });
  }());

  // 15.5 x-user-defined

  // 15.5.2 x-user-defined encoder
  /**
   * @constructor
   * @implements {Encoder}
   * @param {{fatal: boolean}} options
   */
  function XUserDefinedEncoder(options) {
    var fatal = options.fatal;
    /**
     * @param {Stream} stream Input stream.
     * @param {number} code_point Next code point read from the stream.
     * @return {(number|!Array.<number>)} Byte(s) to emit.
     */
    this.handler = function(stream, code_point) {
      // 1.If code point is end-of-stream, return finished.
      if (code_point === end_of_stream)
        return finished;

      // 2. If code point is an ASCII code point, return a byte whose
      // value is code point.
      if (isASCIICodePoint(code_point))
        return code_point;

      // 3. If code point is in the range U+F780 to U+F7FF, inclusive,
      // return a byte whose value is code point − 0xF780 + 0x80.
      if (inRange(code_point, 0xF780, 0xF7FF))
        return code_point - 0xF780 + 0x80;

      // 4. Return error with code point.
      return encoderError(code_point);
    };
  }

  /** @param {{fatal: boolean}} options */
  encoders['x-user-defined'] = function(options) {
    return new XUserDefinedEncoder(options);
  };
  /** @param {{fatal: boolean}} options */

  if (!global['LegacyTextEncoder'])
    global['LegacyTextEncoder'] = LegacyTextEncoder;
  if (!global['TextDecoder'])
    global['TextDecoder'] = TextDecoder;

  if (typeof module !== "undefined" && module.exports) {
    module.exports = {
      LegacyTextEncoder: global['LegacyTextEncoder'],
      TextDecoder: global['TextDecoder'],
      EncodingIndexes: global["encoding-indexes"]
    };
  }

// For strict environments where `this` inside the global scope
// is `undefined`, take a pure object instead
}(this || {}));

var PIKCELLS = PIKCELLS || {};

PIKCELLS.profiling = false;
PIKCELLS.debugging = false;

PIKCELLS.CompressionMethod = {
  RAW: 0x00574152,
  MG1: 0x0031474d,
  MG2: 0x0032474d
};

PIKCELLS.Flags = {
  NORMALS: 0x00000001,
  SMOOTH:  0x00000010,
  MATID:   0x00000100,
};

PIKCELLS.File = function(stream){
  this.load(stream);
};

PIKCELLS.File.prototype.load = function(stream){
  this.header = new PIKCELLS.FileHeader(stream);

  this.body = new PIKCELLS.FileBody(this.header);

  this.getReader().read(stream, this.body);
};

PIKCELLS.File.prototype.getReader = function(){
  var reader;

  switch(this.header.compressionMethod){
    case PIKCELLS.CompressionMethod.RAW:
      reader = new PIKCELLS.ReaderRAW();
      break;
    case PIKCELLS.CompressionMethod.MG1:
      reader = new PIKCELLS.ReaderMG1();
      break;
    case PIKCELLS.CompressionMethod.MG2:
      reader = new PIKCELLS.ReaderMG2();
      break;
  }

  return reader;
};

PIKCELLS.FileHeader = function(stream){
  stream.readInt32(); //magic "OPIKCELLS"
  this.fileFormat = stream.readInt32();
  this.compressionMethod = stream.readInt32();
  this.vertexCount = stream.readInt32();
  this.triangleCount = stream.readInt32();
  this.uvMapCount = stream.readInt32();
  this.attrMapCount = stream.readInt32();
  this.flags = stream.readInt32();
  this.comment = stream.readString();
};

PIKCELLS.FileHeader.prototype.hasNormals = function(){
  return this.flags & PIKCELLS.Flags.NORMALS;
};

PIKCELLS.FileHeader.prototype.hasSmooth = function(){
  return this.flags & PIKCELLS.Flags.SMOOTH;
};

PIKCELLS.FileHeader.prototype.hasMatID = function(){
  return this.flags & PIKCELLS.Flags.MATID;
};

PIKCELLS.FileBody = function(header){
  var i = header.triangleCount * 3,
      v = header.vertexCount * 3,
      n = header.hasNormals()? header.vertexCount * 3: 0,
      s = header.hasSmooth()? header.triangleCount: 0,
      m = header.hasMatID()? header.triangleCount: 0,
      u = header.vertexCount * 2,
      a = header.vertexCount * 4,
      j = 0;

  var data = new ArrayBuffer(
    (i + v + n + s + m + (u * header.uvMapCount) + (a * header.attrMapCount) ) * 4);

  this.indices = new Uint32Array(data, 0, i);

  this.vertices = new Float32Array(data, i * 4, v);

  if ( header.hasNormals() ){
    this.normals = new Float32Array(data, (i + v) * 4, n);
  }
  if ( header.hasSmooth() ){
    this.Smooth = new Uint32Array(data, (i + v + n) * 4, s);
  }
  if ( header.hasMatID() ){
    this.MatID = new Uint32Array(data, (i + v + n + s) * 4, m);
  }
  if (header.uvMapCount){
    this.uvMaps = [];
    for (j = 0; j < header.uvMapCount; ++ j){
      this.uvMaps[j] = {uv: new Float32Array(data,
        (i + v + n + s + m + (j * u) ) * 4, u) };
    }
  }
  if (header.attrMapCount){
    this.attrMaps = [];
    for (j = 0; j < header.attrMapCount; ++ j){
      this.attrMaps[j] = {attr: new Float32Array(data,
        (i + v + n + s + m + (u * header.uvMapCount) + (j * a) ) * 4, a) };
    }
  }
};

PIKCELLS.FileMG2Header = function(stream){
  stream.readInt32(); //magic "MG2H"
  this.vertexPrecision = stream.readFloat32();
  this.normalPrecision = stream.readFloat32();
  this.lowerBoundx = stream.readFloat32();
  this.lowerBoundy = stream.readFloat32();
  this.lowerBoundz = stream.readFloat32();
  this.higherBoundx = stream.readFloat32();
  this.higherBoundy = stream.readFloat32();
  this.higherBoundz = stream.readFloat32();
  this.divx = stream.readInt32();
  this.divy = stream.readInt32();
  this.divz = stream.readInt32();

  this.sizex = (this.higherBoundx - this.lowerBoundx) / this.divx;
  this.sizey = (this.higherBoundy - this.lowerBoundy) / this.divy;
  this.sizez = (this.higherBoundz - this.lowerBoundz) / this.divz;
};

PIKCELLS.ReaderMG2 = function(){
};

PIKCELLS.ReaderMG2.prototype.read = function(stream, body){
  this.MG2Header = new PIKCELLS.FileMG2Header(stream);

  this.readVertices(stream, body.vertices);
  this.readIndices(stream, body.indices);

  if (body.normals){
    this.readNormals(stream, body);
  }
  if (body.Smooth){
    this.readSmooth(stream, body.Smooth);
  }
  if (body.MatID){
    this.readMatID(stream, body.MatID);
  }
  if (body.uvMaps){
    this.readUVMaps(stream, body.uvMaps);
  }
  if (body.attrMaps){
    this.readAttrMaps(stream, body.attrMaps);
  }
};

PIKCELLS.ReaderMG2.prototype.readVertices = function(stream, vertices){
  stream.readInt32(); //magic "VERT"
  var size = stream.readInt32(); //packed sizer

  var interleaved = new PIKCELLS.InterleavedStream(vertices, 3);
  if (PIKCELLS.profiling)
    console.time( "Decompress verts" );
  PIKCELLS.decompress(stream, size, interleaved, vertices);
  if (PIKCELLS.profiling)
    console.timeEnd( "Decompress verts" );

  if (PIKCELLS.profiling)
    console.time( "Read Grid Indices" );
  var gridIndices = this.readGridIndices(stream, vertices);
  if (PIKCELLS.profiling)
    console.timeEnd( "Read Grid Indices" );

  if (PIKCELLS.profiling)
    console.time( "Restore Vertices" );
  PIKCELLS.CustomRestoreVertices( vertices, this.MG2Header, gridIndices );
  if (PIKCELLS.profiling)
    console.timeEnd( "Restore Vertices" );
  
};

PIKCELLS.CustomRestoreVertices = function ( vertices, mg2Header, gridIndices ) {

  var grid = mg2Header;
  var precision = mg2Header.vertexPrecision;

    var gridIdx, delta, x, y, z,
      ydiv = grid.divx, zdiv = ydiv * grid.divy,
      prevGridIdx = 0x7fffffff, prevDelta = 0,
      i = 0, j = 0, len = gridIndices.length;

  for (; i < len; j += 3){
    x = gridIdx = gridIndices[i ++];

    z = ~~(x / zdiv);
    x -= ~~(z * zdiv);
    y = ~~(x / ydiv);
    x -= ~~(y * ydiv);

    delta = vertices[j];
    if (gridIdx === prevGridIdx){
      delta += prevDelta;
    }

    vertices[j]     = grid.lowerBoundx +
      x * grid.sizex + precision * delta;
    vertices[j + 1] = grid.lowerBoundy +
      y * grid.sizey + precision * vertices[j + 1];
    vertices[j + 2] = grid.lowerBoundz +
      z * grid.sizez + precision * vertices[j + 2];

    prevGridIdx = gridIdx;
    prevDelta = delta;
  }

  vertices = null;

}


PIKCELLS.ReaderMG2.prototype.readGridIndices = function(stream, vertices){
  stream.readInt32(); //magic "GIDX"
  var size = stream.readInt32(); //packed size

  var gridIndices = new Uint32Array(vertices.length / 3);

  var interleaved = new PIKCELLS.InterleavedStream(gridIndices, 1);
  PIKCELLS.decompress(stream, size, interleaved, gridIndices);

  PIKCELLS.restoreGridIndices(gridIndices, gridIndices.length);

  return gridIndices;
};

PIKCELLS.ReaderMG2.prototype.readIndices = function(stream, indices){
  stream.readInt32(); //magic "INDX"
  var size = stream.readInt32(); //packed size

  var interleaved = new PIKCELLS.InterleavedStream(indices, 3);
  if (PIKCELLS.profiling)
    console.time("Decompress indices");
  PIKCELLS.decompress(stream, size, interleaved, indices);
  if (PIKCELLS.profiling)
    console.timeEnd("Decompress indices");

  if (PIKCELLS.profiling)
    console.time("Restore indices");
  PIKCELLS.CustomRestoreIndices( indices );

  if (PIKCELLS.profiling)
    console.timeEnd("Restore indices");

};

PIKCELLS.ReaderMG2.prototype.readNormals = function(stream, body){
  stream.readInt32(); //magic "NORM"
  var size = stream.readInt32(); //packed size

  var interleaved = new PIKCELLS.InterleavedStream(body.normals, 3);
  PIKCELLS.decompress(stream, size, interleaved);

  var smooth = PIKCELLS.calcSmoothNormals(body.indices, body.vertices);

  PIKCELLS.restoreNormals(body.normals, smooth, this.MG2Header.normalPrecision);
};

PIKCELLS.ReaderMG2.prototype.readSmooth = function(stream, smooth){
  stream.readInt32(); //magic "FSMG"
  var size = stream.readInt32(); //packed size

  var interleaved = new PIKCELLS.InterleavedStream(smooth, 1);
  PIKCELLS.decompress(stream, size, interleaved);
  // need restore?
};

PIKCELLS.ReaderMG2.prototype.readMatID = function(stream, matID){
  stream.readInt32(); //magic "FMID"
  var size = stream.readInt32(); //packed size

  var interleaved = new PIKCELLS.InterleavedStream(matID, 1);
  PIKCELLS.decompress(stream, size, interleaved);
  // need restore?
};

PIKCELLS.CustomRestoreIndices = function ( indices ) {

  var len = indices.length;
  var i = 3;
  if (len > 0){
    indices[2] += indices[0];
    indices[1] += indices[0];
  }
  for (; i < len; i += 3){
    indices[i] = indices[i] += indices[i - 3];

    if (indices[i] === indices[i - 3]){
      indices[i+1] = indices[i + 1] += indices[i - 2];
    }else{
      indices[i+1] = indices[i + 1] += indices[i];
    }

    indices[i+2] = indices[i + 2] += indices[i];
  }

}


PIKCELLS.ReaderMG2.prototype.readUVMaps = function(stream, uvMaps){

  var i = 0;
  for (; i < uvMaps.length; ++ i){
    stream.readInt32(); //magic "TEXC"

    uvMaps[i].name = stream.readString();
    uvMaps[i].filename = stream.readString();

    var precision = stream.readFloat32();

    var size = stream.readInt32(); //packed size

    var interleaved = new PIKCELLS.InterleavedStream(uvMaps[i].uv, 2);

    if (PIKCELLS.profiling)
      console.time("UV Maps decompress time");
    PIKCELLS.decompress(stream, size, interleaved, uvMaps[i].uv);
    if (PIKCELLS.profiling)
      console.timeEnd("UV Maps decompress time");

    if (PIKCELLS.profiling)
      console.time("UV Maps restore time");

    PIKCELLS.customRestoreMap(uvMaps[i].uv, 2, precision);
    if (PIKCELLS.profiling)
      console.timeEnd("UV Maps restore time");

  }
};

PIKCELLS.ReaderMG2.prototype.readAttrMaps = function(stream, attrMaps){
  var i = 0;
  for (; i < attrMaps.length; ++ i){
    stream.readInt32(); //magic "ATTR"

    attrMaps[i].name = stream.readString();

    var precision = stream.readFloat32();

    var size = stream.readInt32(); //packed size

    var interleaved = new PIKCELLS.InterleavedStream(attrMaps[i].attr, 4);
    PIKCELLS.decompress(stream, size, interleaved);

    PIKCELLS.restoreMap(attrMaps[i].attr, 4, precision);
  }
};

PIKCELLS.customRestoreMap = function( map, count, precision ){

  var value, i = 0, j, len = map.length;

  for (; i < count; ++ i){

    for (j = i; j < len; j += count){

      value = map[j];

      map[j] = value * precision;

    }
  }

};

PIKCELLS.decompress = function( stream, size, interleaved, target ){
  var offset = stream.offset;

  stream.offset = offset; // rest the offset to try loading again.
  interleaved.data = stream.data.subarray(offset, offset+size);
  stream.offset = offset + size;

  if ( !target )
    return;
  var len = target.length;
  var leafSize = interleaved.count/4;
  // Remove interleaving and reconstruct as integers
  var j,i,k;
  for ( j=0; j<leafSize; j++ ){
    ilen = len/leafSize;
    k=0;
    for ( i=j*ilen; i<(j+1)*ilen; i++ ){

        target[j+k*leafSize] = PIKCELLS.UInt8BytesToInt([
          interleaved.data[i], 
          interleaved.data[i+len], 
          interleaved.data[i+2*len], 
          interleaved.data[i+3*len] 
          ]);
        k++;
    }
  }

};

PIKCELLS.UInt8BytesToInt = function ( data ){

    var integer = data[0] + data[1]*Math.pow(2, 8) + data[2]*Math.pow(2, 16) + data[3]*Math.pow(2, 24);
    if ( integer > (Math.pow(2, 32)/2) ){

        integer =  - Math.pow(2, 32) + integer;

    }
    return integer;

}

PIKCELLS.restoreSmooth = function(smooth, len){
  console.log(smooth);
}

PIKCELLS.restoreMaterialIDs = function(materialIDs, len){

  console.log(materialIDs);

}

PIKCELLS.restoreIndices = function(indices, len){
  var i = 3;
  if (len > 0){
    indices[2] += indices[0];
    indices[1] += indices[0];
  }
  for (; i < len; i += 3){
    indices[i] += indices[i - 3];

    if (indices[i] === indices[i - 3]){
      indices[i + 1] += indices[i - 2];
    }else{
      indices[i + 1] += indices[i];
    }

    indices[i + 2] += indices[i];
  }
};

PIKCELLS.restoreGridIndices = function(gridIndices, len){
  var i = 1;
  for (; i < len; ++ i){
    gridIndices[i] += gridIndices[i - 1];
  }
};

PIKCELLS.restoreVertices = function(vertices, grid, gridIndices, precision){
  var gridIdx, delta, x, y, z,
      intVertices = new Uint32Array(vertices.buffer, vertices.byteOffset, vertices.length),
      ydiv = grid.divx, zdiv = ydiv * grid.divy,
      prevGridIdx = 0x7fffffff, prevDelta = 0,
      i = 0, j = 0, len = gridIndices.length;

  for (; i < len; j += 3){
    x = gridIdx = gridIndices[i ++];

    z = ~~(x / zdiv);
    x -= ~~(z * zdiv);
    y = ~~(x / ydiv);
    x -= ~~(y * ydiv);

    delta = intVertices[j];
    if (gridIdx === prevGridIdx){
      delta += prevDelta;
    }

    vertices[j]     = grid.lowerBoundx +
      x * grid.sizex + precision * delta;
    vertices[j + 1] = grid.lowerBoundy +
      y * grid.sizey + precision * intVertices[j + 1];
    vertices[j + 2] = grid.lowerBoundz +
      z * grid.sizez + precision * intVertices[j + 2];

    prevGridIdx = gridIdx;
    prevDelta = delta;
  }
};

PIKCELLS.restoreNormals = function(normals, smooth, precision){
  var ro, phi, theta, sinPhi,
      nx, ny, nz, by, bz, len,
      intNormals = new Uint32Array(normals.buffer, normals.byteOffset, normals.length),
      i = 0, k = normals.length,
      PI_DIV_2 = 3.141592653589793238462643 * 0.5;

  for (; i < k; i += 3){
    ro = intNormals[i] * precision;
    phi = intNormals[i + 1];

    if (phi === 0){
      normals[i]     = smooth[i]     * ro;
      normals[i + 1] = smooth[i + 1] * ro;
      normals[i + 2] = smooth[i + 2] * ro;
    }else{

      if (phi <= 4){
        theta = (intNormals[i + 2] - 2) * PI_DIV_2;
      }else{
        theta = ( (intNormals[i + 2] * 4 / phi) - 2) * PI_DIV_2;
      }

      phi *= precision * PI_DIV_2;
      sinPhi = ro * Math.sin(phi);

      nx = sinPhi * Math.cos(theta);
      ny = sinPhi * Math.sin(theta);
      nz = ro * Math.cos(phi);

      bz = smooth[i + 1];
      by = smooth[i] - smooth[i + 2];

      len = Math.sqrt(2 * bz * bz + by * by);
      if (len > 1e-20){
        by /= len;
        bz /= len;
      }

      normals[i]     = smooth[i]     * nz +
        (smooth[i + 1] * bz - smooth[i + 2] * by) * ny - bz * nx;
      normals[i + 1] = smooth[i + 1] * nz -
        (smooth[i + 2]      + smooth[i]   ) * bz  * ny + by * nx;
      normals[i + 2] = smooth[i + 2] * nz +
        (smooth[i]     * by + smooth[i + 1] * bz) * ny + bz * nx;
    }
  }
};

PIKCELLS.restoreMap = function(map, count, precision){
  var delta, value,
      intMap = new Uint32Array(map.buffer, map.byteOffset, map.length),
      i = 0, j, len = map.length;

  for (; i < count; ++ i){
    delta = 0;

    for (j = i; j < len; j += count){
      value = intMap[j];

      delta += value & 1? -( (value + 1) >> 1): value >> 1;

      map[j] = delta * precision;
    }
  }
};

PIKCELLS.calcSmoothNormals = function(indices, vertices){
  var smooth = new Float32Array(vertices.length),
      indx, indy, indz, nx, ny, nz,
      v1x, v1y, v1z, v2x, v2y, v2z, len,
      i, k;

  for (i = 0, k = indices.length; i < k;){
    indx = indices[i ++] * 3;
    indy = indices[i ++] * 3;
    indz = indices[i ++] * 3;

    v1x = vertices[indy]     - vertices[indx];
    v2x = vertices[indz]     - vertices[indx];
    v1y = vertices[indy + 1] - vertices[indx + 1];
    v2y = vertices[indz + 1] - vertices[indx + 1];
    v1z = vertices[indy + 2] - vertices[indx + 2];
    v2z = vertices[indz + 2] - vertices[indx + 2];

    nx = v1y * v2z - v1z * v2y;
    ny = v1z * v2x - v1x * v2z;
    nz = v1x * v2y - v1y * v2x;

    len = Math.sqrt(nx * nx + ny * ny + nz * nz);
    if (len > 1e-10){
      nx /= len;
      ny /= len;
      nz /= len;
    }

    smooth[indx]     += nx;
    smooth[indx + 1] += ny;
    smooth[indx + 2] += nz;
    smooth[indy]     += nx;
    smooth[indy + 1] += ny;
    smooth[indy + 2] += nz;
    smooth[indz]     += nx;
    smooth[indz + 1] += ny;
    smooth[indz + 2] += nz;
  }

  for (i = 0, k = smooth.length; i < k; i += 3){
    len = Math.sqrt(smooth[i] * smooth[i] + 
      smooth[i + 1] * smooth[i + 1] +
      smooth[i + 2] * smooth[i + 2]);

    if(len > 1e-10){
      smooth[i]     /= len;
      smooth[i + 1] /= len;
      smooth[i + 2] /= len;
    }
  }

  return smooth;
};

PIKCELLS.isLittleEndian = (function(){
  var buffer = new ArrayBuffer(2),
      bytes = new Uint8Array(buffer),
      ints = new Uint16Array(buffer);

  bytes[0] = 1;

  return ints[0] === 1;
}());

PIKCELLS.InterleavedStream = function(data, count){
  this.data = new Uint8Array(data.buffer, data.byteOffset, data.byteLength);
  this.offset = PIKCELLS.isLittleEndian? 3: 0;
  this.count = count * 4;
  this.len = this.data.length;
};

PIKCELLS.InterleavedStream.prototype.writeByte = function(value){
  this.data[this.offset] = value;

  this.offset += this.count;
  if (this.offset >= this.len){

    this.offset -= this.len - 4;
    if (this.offset >= this.count){

      this.offset -= this.count + (PIKCELLS.isLittleEndian? 1: -1);
    }
  }
};

PIKCELLS.Stream = function(data){
  this.data = data;
  this.offset = 0;
};

PIKCELLS.Stream.prototype.TWO_POW_MINUS23 = Math.pow(2, -23);

PIKCELLS.Stream.prototype.TWO_POW_MINUS126 = Math.pow(2, -126);

PIKCELLS.Stream.prototype.readByte = function() {
  return this.data[this.offset ++] & 0xff;
};

PIKCELLS.Stream.prototype.readInt32 = function(){
  var i = this.readByte();
  i |= this.readByte() << 8;
  i |= this.readByte() << 16;
  return i | (this.readByte() << 24);
};

PIKCELLS.Stream.prototype.readFloat32 = function(){
  var m = this.readByte();
  m += this.readByte() << 8;

  var b1 = this.readByte();
  var b2 = this.readByte();

  m += (b1 & 0x7f) << 16; 
  var e = ( (b2 & 0x7f) << 1) | ( (b1 & 0x80) >>> 7);
  var s = b2 & 0x80? -1: 1;

  if (e === 255){
    return m !== 0? NaN: s * Infinity;
  }
  if (e > 0){
    return s * (1 + (m * this.TWO_POW_MINUS23) ) * Math.pow(2, e - 127);
  }
  if (m !== 0){
    return s * m * this.TWO_POW_MINUS126;
  }
  return s * 0;
};

PIKCELLS.Stream.prototype.readString = function(){
  var len = this.readInt32();

  this.offset += len;

  return String.fromCharCode.apply(null, this.data.subarray(this.offset - len, this.offset));
};

PIKCELLS.Stream.prototype.readArrayInt32 = function(array){
  var i = 0, len = array.length;

  while(i < len){
    array[i ++] = this.readInt32();
  }

  return array;
};

PIKCELLS.Stream.prototype.readArrayFloat32 = function(array){
  var i = 0, len = array.length;

  while(i < len){
    array[i ++] = this.readFloat32();
  }

  return array;
};

/**
 * Loader for PIKCELLS encoded models generated by OpenPIKCELLS tools:
 *  http://openctm.sourceforge.net/
 *
 * Uses js-openctm library by Juan Mellado
 *  http://code.google.com/p/js-openctm/
 *
 * @author alteredq / http://alteredqualia.com/
 */

THREE.PIKCELLSLoader = function () {

    THREE.Loader.call( this );

    // Deprecated

    Object.defineProperties( this, {
        statusDomElement: {
            get: function () {

                if ( this._statusDomElement === undefined ) {
                    this._statusDomElement = document.createElement( 'div' );
                }

                console.warn( 'THREE.BinaryLoader: .statusDomElement has been removed.' );
                return this._statusDomElement;

            }
        },
    } );

};

THREE.PIKCELLSLoader.prototype = Object.create( THREE.Loader.prototype );
THREE.PIKCELLSLoader.prototype.constructor = THREE.PIKCELLSLoader;

// Load PIKCELLSLoader compressed models
//  - parameters
//      - url (required)
//      - callback (required)

THREE.PIKCELLSLoader.prototype.load = function( url, callback, parameters, callbackProgress, onReadyStateChange ) {

    parameters = parameters || {};
    var scope = this;
    var offsets = parameters.offsets !== undefined ? parameters.offsets : [ 0 ];
    var xhr = new XMLHttpRequest();

    xhr.onreadystatechange = function() {

        if (onReadyStateChange) {
            onReadyStateChange( this );
        };
        if ( xhr.readyState === 4 ) {

            if ( xhr.status === 200 || xhr.status === 0 ) {

                var binaryData = new Uint8Array(xhr.response);
                if (parameters.useWorker == true) {

                    scope.loadModelWithWorker(binaryData, offsets, callback, parameters);

                }else {

                    scope.loadModel(binaryData, offsets, callback, parameters);
                }

            } else {

                console.error( "Couldn't load [" + url + "] [" + xhr.status + "]" );
            }

        };
    };

    xhr.onprogress = function( e ){
        if (callbackProgress){
            callbackProgress( e );
        }
    }

    xhr.open( "GET", url, true );
    xhr.responseType = "arraybuffer";
    xhr.send( null );
};

THREE.PIKCELLSLoader.prototype.parse = function ( data ) {

	var json = JSON.parse(data);
	var objects = [];

	for ( var i=0; i<json.root.children.length; i++ ){

		objects.push(this.loadObject3D(json.root.children[i]));

	}

	return objects;

}

THREE.PIKCELLSLoader.prototype.loadObject3D = function (object) {

	var sceneObject = new THREE[object.type]();

	for ( var i=0; i<object.children.length; i++ ){

		sceneObject.add(this.loadObject3D(object.children[i]));

	}

	if ( object.geometry != undefined ){

		sceneObject.material = new THREE.MeshStandardMaterial();
		var uint8array = new LegacyTextEncoder('Windows-1252', { NONSTANDARD_allowLegacyEncoding: true }).encode(object.geometry)
		var parameters = { "splitByMatId": true };

		this.loadModel( uint8array, [0], function(geometries){

			sceneObject.geometry = geometries[i];

		}, parameters);

	}

	if ( object.position )
		sceneObject.position.set(object.position.x, object.position.y, object.position.z);

	if ( object.rotation )
		sceneObject.rotation.set(object.rotation._x, object.rotation._y, object.rotation._z);

	if ( object.scale )
		sceneObject.scale.set(object.scale.x, object.scale.y, object.scale.z);

	if (object.name)
		sceneObject.name = object.name;

	return sceneObject;

}

THREE.PIKCELLSLoader.prototype.loadModel = function ( binaryData, offsets, callback, parameters ) {

     for ( var i = 0; i < offsets.length; i ++ ) {

        var stream = new PIKCELLS.Stream( binaryData );
        stream.offset = offsets[ i ];
        var ctmFile = new PIKCELLS.File( stream );
        this.createModel( ctmFile, callback, parameters );

    }

}

THREE.PIKCELLSLoader.prototype.createModel = function ( file, callback, parameters ) {

    var scope = this;

    var uvMaps = file.body.uvMaps;
    var indices = file.body.indices;
    var positions = file.body.vertices;
    var normals = file.body.normals;
    var smooth = file.body.Smooth;
    var matIDs = file.body.MatID;

    var Model = function () {

        //var start = new Date().getTime();

        THREE.Geometry.call( this );

        this.faces = [];
        this.faceVertexUvs = [];
        this.vertices = [];
        this.materials = [];


        // if (positions.length/3 > 65536){
        //     console.warn("65536 vertices exceeded! Geometry " + file + " has " + positions.length/3 + " vertices");
        // }

        var color;

        if ( positions.length/3 > 65536 ){
          color = "background:red";
        }else if ( positions.length/3 > 40000 ){
          color = "background:orange";
        }else if ( positions.length/3 > 20000 ) {
          color = "background:yellow";
        }else {
          color = "background:green";
        }

        if (PIKCELLS.debugging)
          console.log("%c Geometry ", color, + file + " has " + positions.length/3 + " vertices");

        var vertexNormals = [];
        var emptyVector = new THREE.Vector3(0,0,0);
        var len;
        var vertex;
        var normal;
        var face;
        var materialIndex = 0;

        if (normals){

            len = positions.length;
            
            for (var i=0; i<len; i=i+3){

                vertex = new THREE.Vector3(positions[i],positions[i+1],positions[i+2]);
                normal = new THREE.Vector3(normals[i], normals[i+1], normals[i+2]);
                normal.normalize();
                this.vertices.push(vertex);
                vertexNormals.push(normal);

            }
            len = indices.length
            
            for (var i=0; i<len; i=i+3){

                if (matIDs)
                    materialIndex = matIDs[i/3];
                
                face = new THREE.Face3( indices[i], indices[i+1], indices[i+2], null, null, materialIndex );
                face.vertexNormals = [ vertexNormals[indices[i]], vertexNormals[indices[i+1]], vertexNormals[indices[i+2]] ];
                this.faces.push( face );

            }

        }else{

            len = positions.length;
            for (var i=0; i<len; i=i+3){
                this.vertices.push(new THREE.Vector3(positions[i],positions[i+1],positions[i+2]));
            }
            len = indices.length;
            if (matIDs){
                for (var i=0; i<len; i=i+3){
                    materialIndex = matIDs[i/3];
                    this.faces.push(new THREE.Face3(indices[i], indices[i+1], indices[i+2], emptyVector, null, materialIndex));
                } 
            }else{
                for (var i=0; i<len; i=i+3){
                    this.faces.push(new THREE.Face3(indices[i], indices[i+1], indices[i+2], emptyVector, null, materialIndex));
                }  
            }

        }
        var uvIndexA;
        var uvIndexB;
        var uvIndexC;
        var uvMap;
        var faceVertexUV;
        var uvFaceArray;
        if (!uvMaps){
          uvMaps = [];
          this.computeBoundingBox();
          var max = this.boundingBox.max,
              min = this.boundingBox.min;
          var offset = new THREE.Vector2(0 - min.x, 0 - min.y);
          var range = new THREE.Vector2(max.x - min.x, max.y - min.y);
          var faces = this.faces;

          this.faceVertexUvs[0] = [];

          for (var i = 0; i < faces.length ; i++) {

              var v1 = this.vertices[faces[i].a], 
                  v2 = this.vertices[faces[i].b], 
                  v3 = this.vertices[faces[i].c];

              this.faceVertexUvs[0].push([
                  new THREE.Vector2((v1.x + offset.x)/range.x ,(v1.y + offset.y)/range.y),
                  new THREE.Vector2((v2.x + offset.x)/range.x ,(v2.y + offset.y)/range.y),
                  new THREE.Vector2((v3.x + offset.x)/range.x ,(v3.y + offset.y)/range.y)
              ]);
          }
          this.uvsNeedUpdate = true;
        }
        for (var uvChannel=0; uvChannel<uvMaps.length; uvChannel++){
            uvMap = uvMaps[uvChannel].uv;
            len = this.faces.length;
            this.faceVertexUvs.push([]);
            for (var i=0; i<len; i++){
                face = this.faces[i];
                this.faceVertexUvs[uvChannel].push([
                    new THREE.Vector2(uvMap[face.a*2],uvMap[face.a*2+1]),
                    new THREE.Vector2(uvMap[face.b*2],uvMap[face.b*2+1]), 
                    new THREE.Vector2(uvMap[face.c*2],uvMap[face.c*2+1])
                    ]);
            }
        }

        if(normals){
          if (PIKCELLS.debugger)
            console.log("Have normals");
        /*}else if (smooth){
            console.log ("Computing normals from smoothGroups");
            scope.createNormalsFromSmoothGroups(this, smooth);*/
        }else{
            if (PIKCELLS.debugger)
              console.log ("No normal or smooth data found, computing average normals.");
            this.computeFaceNormals();
            this.computeVertexNormals();
        }

        //var end = new Date().getTime();
        //var time = end - start;
        //console.log('Face execution time: ' + time);
    };

    Model.prototype = Object.create( THREE.Geometry.prototype );
    Model.prototype.constructor = Model;

    var geometry = new Model();
    if ( parameters.splitByMatId && matIDs ){

        var geometries = this.splitGeometryByMatIds( geometry );
        callback( geometries );

    }else{
        callback( [geometry] );
    }

};
