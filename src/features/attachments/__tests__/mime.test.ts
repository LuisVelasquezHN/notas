import { fileExtension, formatDuration } from '../mime';

describe('fileExtension', () => {
  it.each([
    ['image/jpeg', 'file:///tmp/a', 'jpg'],
    ['image/PNG', 'file:///tmp/a', 'png'],
    ['audio/webm;codecs=opus', 'blob:x', 'webm'],
    ['audio/mp4', 'file:///rec.m4a', 'm4a'],
    [null, 'file:///tmp/photo.HEIC', 'heic'],
    [undefined, 'file:///tmp/rec.m4a?x=1', 'm4a'],
    ['application/x-unknown', 'data:foo', 'bin'],
  ])('%s + %s → %s', (mime, uri, ext) => {
    expect(fileExtension(mime, uri)).toBe(ext);
  });
});

describe('formatDuration', () => {
  it.each([
    [0, '0:00'],
    [null, '0:00'],
    [999, '0:01'],
    [65_000, '1:05'],
    [750_000, '12:30'],
    [3_723_000, '1:02:03'],
  ])('%s ms → %s', (ms, text) => {
    expect(formatDuration(ms)).toBe(text);
  });
});
