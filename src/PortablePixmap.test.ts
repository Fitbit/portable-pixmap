import PortablePixmap, { PPMParseError } from './PortablePixmap';

describe('successfully parses', () => {
  const vectors: [string, string, number, number, number, number[]][] = [
    ['a straighforward 1x1 px image', 'P6 1 1 255\n\x12\x34\x56', 1, 1, 255, [0x12, 0x34, 0x56]],
    [
      'a larger image', 'P6 2 3 100\nabcdefghijklmnopqr', 2, 3, 100, [
        97, 98, 99,
        100, 101, 102,
        103, 104, 105,
        106, 107, 108,
        109, 110, 111,
        112, 113, 114,
      ],
    ],
    ['an image with maxval 1', 'P6 1 1 1\n\0\x01\x02', 1, 1, 1, [0, 1, 2]],
    ['an image with trailing data', 'P6 1 1 255\n\0\0\0\x01', 1, 1, 255, [0, 0, 0]],
    ['tabs and CR in the header', 'P6\t1\t1\t255\r\x02\x03\x05', 1, 1, 255, [2, 3, 5]],
    ['varying amounts of whitespace', 'P6  \n\t1    \n1\n\n\t\r  3\r\0\0\0', 1, 1, 3, [0, 0, 0]],
    ['comment after magic', 'P6# 42\n\n1\r 1\n36\n\0\0\0', 1, 1, 36, [0, 0, 0]],
    ['comment inside whitespace after magic', 'P6 # 42\n\n1\r 1\n36\n\0\0\0', 1, 1, 36, [0, 0, 0]],
    ['comment before width', 'P6 # 42\n1\r 1\n36\n\0\0\0', 1, 1, 36, [0, 0, 0]],
    ['comment inside width', 'P6 \n0#23\r1 1\n36\n\0\0\0', 1, 1, 36, [0, 0, 0]],
    ['comment following width', 'P6 \n1#23\r 1\n36\n\0\0\0', 1, 1, 36, [0, 0, 0]],
    ['comment inside whitespace after width', 'P6 \n1\t#23\r 1\n36\n\0\0\0', 1, 1, 36, [0, 0, 0]],
    ['comment before height', 'P6 1 # 1\n1\n36\n\0\0\0', 1, 1, 36, [0, 0, 0]],
    ['comment inside height', 'P6 1 0# 123\r2\n36\n\0\0\0\0\0\0', 1, 2, 36, [0, 0, 0, 0, 0, 0]],
    ['comment following height', 'P6 1 1#0\n 36\n\0\0\0', 1, 1, 36, [0, 0, 0]],
    ['comment in whitespace after height', 'P6 1 1 #foo\n 36\n\0\0\0', 1, 1, 36, [0, 0, 0]],
    ['comment before maxval', 'P6 1 1 #0\n36\n\0\0\0', 1, 1, 36, [0, 0, 0]],
    ['comment inside maxval', 'P6 1 1 3#42\n6\n\0\0\0', 1, 1, 36, [0, 0, 0]],
    ['comment after maxval', 'P6 1 1 36# comment!\n\n\0\0\0', 1, 1, 36, [0, 0, 0]],
    // tslint:disable-next-line:max-line-length
    ['multiple comments', 'P6# 42\n\n1 # 100\r 1\n#12\n3#\n#\r#\n6#\tfoo\r\n\0\0\0', 1, 1, 36, [0, 0, 0]],
  ];

  for (const [description, data, width, height, maxval, expected] of vectors) {
    test(description, () => {
      const pixmap = PortablePixmap.parse(Buffer.from(data, 'binary'));
      expect(pixmap).toEqual(expect.objectContaining({ width, height, maxval }));
      expect(pixmap.data).toEqual(Buffer.from(expected));
    });
  }
});

describe('throws an error when parsing', () => {
  const vectors = [
    ['an empty file', ''],
    ['bad magic', 'P4 1 1 1\n\0\0\0'],
    ['missing whitespace between magic and width', 'P61 1 1\n\0\0\0'],
    ['comment but no whitespace between magic and width', 'P6# \n1 1 1\n\0\0\0'],
    ['comment but no whitespace between width and height', 'P6 1# \n1 1\n\0\0\0'],
    ['comment but no whitespace height and maxval', 'P6 1 1# \t\n1\n\0\0\0'],
    ['zero width', 'P6 0 1 1\n\0\0\0'],
    ['zero height', 'P6 1 0 1\n\0\0\0'],
    ['zero maxval', 'P6 1 1 0\n\0\0\0'],
    ['maxval greater than 65535', 'P6 1 1 65536\n\0\0\0'],
    ['a truncated file', 'P6 1 1 255\n\0\0'],
    ['space after maxval', 'P6 1 1 255 \n\0\0\0'],
    ['tab after maxval', 'P6 1 1 255\t\n\0\0\0'],
    ['garbage characters at the start of width', 'P6 a1 1 1\n\0\0\0'],
    ['garbage characters in the middle of width', 'P6 1a2 1 1\n\0\0\0'],
    ['garbage characters at the end of width', 'P6 1a 1 1\n\0\0\0'],
    ['garbage characters at the start of height', 'P6 1 a1 1\n\0\0\0'],
    ['garbage characters in the middle of height', 'P6 1 1a1 1\n\0\0\0'],
    ['garbage characters at the end of height', 'P6 1 1a 1\n\0\0\0'],
    ['garbage characters at the start of maxval', 'P6 1 1 a1\n\0\0\0'],
    ['garbage characters in the middle of maxval', 'P6 1 1 1a1\n\0\0\0'],
    ['garbage characters at the end of maxval', 'P6 1 1 1a\n\0\0\0'],
  ];

  for (const [description, vector] of vectors) {
    test(
      description,
      () => expect(
        () => PortablePixmap.parse(Buffer.from(vector, 'binary')),
      ).toThrow(PPMParseError),
    );
  }
});

describe('toRGB88888', () => {
  describe('converts the image correctly', () => {
    const vectors: [string, number, number, number, number[], number[]][] = [
      [
        'maxval is 1',
        3, 1, 1, [0, 0, 1, 0, 1, 0, 1, 0, 0],
        [0, 0, 255, 255, 0, 255, 0, 255, 255, 0, 0, 255],
      ],
      [
        'maxval is small',
        1, 3, 10, [1, 2, 3, 4, 5, 6, 7, 8, 9],
        [26, 51, 76, 255, 102, 128, 153, 255, 178, 204, 230, 255],
      ],
      [
        'maxval is exactly 255',
        2, 2, 255, [0, 123, 200, 255, 254, 253, 1, 2, 3, 55, 66, 77],
        [0, 123, 200, 255, 255, 254, 253, 255, 1, 2, 3, 255, 55, 66, 77, 255],
      ],
      [
        'maxval is 256',
        1, 1, 256, [0, 255, 1, 0, 0, 128],
        [254, 255, 128, 255],
      ],
      [
        'maxval is 65535',
        1, 1, 65535, [255, 255, 255, 0, 0, 255],
        [255, 254, 1, 255],
      ],
      [
        'souce values exceed maxval',
        1, 1, 15, [15, 16, 200],
        [255, 255, 255, 255],
      ],
    ];

    for (const [description, width, height, maxval, data, rgb] of vectors) {
      test(`when ${description}`, () => {
        const pixmap = new PortablePixmap(width, height, maxval, Buffer.from(data));
        expect(pixmap.toRGBA8888()).toEqual(new Uint8ClampedArray(rgb));
      });
    }
  });

  it('writes in-place to a given array', () => {
    const destination = new Uint8ClampedArray(8);
    const pixmap = new PortablePixmap(1, 2, 4, Buffer.from([3, 2, 1, 0, 4, 2]));
    pixmap.toRGBA8888(destination);
    expect(destination).toEqual(new Uint8ClampedArray([191, 128, 64, 255, 0, 255, 128, 255]));
  });

  it('refuses to write into a too-small array', () => {
    const destination = new Uint8ClampedArray((2 * 3 * 3) - 1);
    const pixmap = new PortablePixmap(2, 3, 255, new Buffer(2 * 3 * 3));
    expect(() => pixmap.toRGBA8888(destination)).toThrow('Destination array too small');
  });

  it('writes into an oversized destination array', () => {
    const destination = new Uint8ClampedArray(100);
    const pixmap = new PortablePixmap(2, 3, 255, new Buffer(2 * 3 * 3));
    expect(() => pixmap.toRGBA8888(destination)).not.toThrow(expect.anything());
  });
});
