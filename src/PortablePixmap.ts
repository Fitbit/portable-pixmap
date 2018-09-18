import ErrorSubclass from 'error-subclass';

// The PPM format does not place a limit on the size of the header, but
// we will do so for convenience of parsing. This is very unlikely to be
// exceeded unless someone's doing something exotic with comments.
const MAX_HEADER_LENGTH = 4096;

export class PPMParseError extends ErrorSubclass {
  static displayName = 'PPMParseError';
}

/**
 * Parses a numeric header field, handling embedded comments.
 *
 * @param {string} field - the raw lexed field string
 * @returns {number} - the parsed number encoded in the field
 */
function parseHeaderField(field: string): number {
  return parseInt(field.replace(/#.*[\r\n]/g, ''), 10);
}

/**
 * Netpbm PPM color image format.
 *
 * http://netpbm.sourceforge.net/doc/ppm.html
 */
export default class PortablePixmap {
  /**
   * Construct a PPM instance directly in memory.
   */
  constructor(
    public width: number,
    public height: number,
    public maxval: number,
    public data: Buffer,
  ) {}

  /**
   * Convert the image data to an RGBA8888 raster, suitable for input to
   * an HTML5 Canvas API ImageData object.
   *
   * @param destination existing array to write into
   */
  toRGBA8888(destination?: Uint8Array | Uint8ClampedArray) {
    const pixels = this.width * this.height;
    const buffer = destination || new Uint8ClampedArray(pixels * 4);

    if (buffer.length < pixels * 4) throw new Error('Destination array too small');

    if (this.maxval < 256) {
      for (let i = 0; i < pixels; i += 1) {
        buffer[i * 4] = (this.data[i * 3] * 255) / this.maxval;
        buffer[(i * 4) + 1] = (this.data[(i * 3) + 1] * 255) / this.maxval;
        buffer[(i * 4) + 2] = (this.data[(i * 3) + 2] * 255) / this.maxval;
        buffer[(i * 4) + 3] = 255;  // Alpha
      }
    } else {
      for (let i = 0; i < pixels; i += 1) {
        buffer[(i * 4)] = (this.data.readUInt16BE(i * 6) * 255) / this.maxval;
        buffer[(i * 4) + 1] = (this.data.readUInt16BE((i * 6) + 2) * 255) / this.maxval;
        buffer[(i * 4) + 2] = (this.data.readUInt16BE((i * 6) + 4) * 255) / this.maxval;
        buffer[(i * 4) + 3] = 255;  // Alpha
      }
    }

    return buffer;
  }

  /**
   * Parse PPM (Netpbm color image) format data.
   *
   * The pixel raster data in the constructed image is a slice of the
   * input buffer, so mutating the buffer will also mutate the image.
   *
   * @param buffer buffer of PPM-format image data
   */
  static parse(buffer: Buffer) {
    // Comments in the header are weird:
    //   Before the whitespace character that delimits the raster, any
    //   characters from a "#" through the next carriage return or newline
    //   character, is a comment and is ignored. Note that this is rather
    //   unconventional, because a comment can actually be in the middle
    //   of what you might consider a token. Note also that this means if
    //   you have a comment right before the raster, the newline at the
    //   end of the comment is not sufficient to delimit the raster.
    const lexer = {
      magic: /P6(?:\s|#.*[\r\n])*\s/y,
      dimension: /(?:\s|#.*[\r\n])*(\d(?:\d|#.*[\r\n])*)\s+/y,
      maxval: /(?:\s|#.*[\r\n])*(\d(?:\d|#.*[\r\n])*)[\r\n]/y,
    };

    const header = buffer.toString('binary', 0, MAX_HEADER_LENGTH);
    if (!lexer.magic.test(header)) {
      throw new PPMParseError('bad magic');
    }

    lexer.dimension.lastIndex = lexer.magic.lastIndex;
    const widthField = lexer.dimension.exec(header);
    if (widthField === null) throw new PPMParseError('malformed width');

    const heightField = lexer.dimension.exec(header);
    if (heightField === null) throw new PPMParseError('malformed height');

    lexer.maxval.lastIndex = lexer.dimension.lastIndex;
    const maxvalField = lexer.maxval.exec(header);
    if (maxvalField === null) throw new PPMParseError('malformed maxval');

    const width = parseHeaderField(widthField[1]);
    const height = parseHeaderField(heightField[1]);
    const maxval = parseHeaderField(maxvalField[1]);

    if (width === 0) throw new PPMParseError('width is zero');
    if (height === 0) throw new PPMParseError('height is zero');
    if (maxval <= 0 || maxval >= 65536) {
      throw new PPMParseError(`maxval out of range: ${maxval}`);
    }

    const rasterStart = lexer.maxval.lastIndex;
    const rasterEnd = rasterStart + (width * height * 3 * (maxval > 255 ? 2 : 1));
    if (rasterEnd > buffer.length) throw new PPMParseError('truncated file');
    return new this(width, height, maxval, buffer.slice(rasterStart, rasterEnd));
  }
}
