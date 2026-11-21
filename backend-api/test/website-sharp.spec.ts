import sharp from 'sharp';
import { SharpImagePort } from '../src/v3-website/media/media.ports';

/** The real image port (sharp, local, no network): it re-encodes in the same format, drops metadata, reports the size, and refuses unreadable or oversized pictures. */
const port = new SharpImagePort();
const png = (w: number, h: number) => sharp({ create: { width: w, height: h, channels: 3, background: '#336699' } }).png().toBuffer();
const jpegWithExif = () => sharp({ create: { width: 40, height: 20, channels: 3, background: '#aa5500' } }).withExif({ IFD0: { Copyright: 'someone', ImageDescription: 'secret place' } }).jpeg().toBuffer();

describe('SharpImagePort', () => {
  it('re-encodes a png and reports its size', async () => {
    const r = await port.reencode(await png(64, 32), { maxPixels: 1_000_000 });
    expect(r).toMatchObject({ contentType: 'image/png', width: 64, height: 32 }); expect(r.bytes.length).toBeGreaterThan(0);
  });
  it('drops metadata such as camera and location text', async () => {
    const original = await jpegWithExif(); expect((await sharp(original).metadata()).exif).toBeDefined();
    const r = await port.reencode(original, { maxPixels: 1_000_000 });
    expect(r.contentType).toBe('image/jpeg'); expect((await sharp(r.bytes).metadata()).exif).toBeUndefined(); expect(r.bytes.toString('latin1')).not.toContain('secret place');
  });
  it('refuses bytes that are not a picture and a picture over the pixel cap', async () => {
    await expect(port.reencode(Buffer.from('not a picture'), { maxPixels: 1_000_000 })).rejects.toBeDefined();
    await expect(port.reencode(await png(200, 200), { maxPixels: 1000 })).rejects.toBeDefined();
  });
});
