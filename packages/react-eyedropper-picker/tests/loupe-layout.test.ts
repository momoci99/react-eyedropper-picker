import { afterEach, describe, expect, it, vi } from 'vitest'
import { sourceLayout } from '../src/loupe/layout'
import { mockSource, mockVideo } from './loupe-mocks'

afterEach(() => {
  vi.restoreAllMocks()
  document.body.innerHTML = ''
})

describe('sourceLayout', () => {
  it('is the element box by default', () => {
    const source = mockSource(100, 50)
    const box = { left: 0, top: 0, width: 100, height: 50 }
    expect(sourceLayout(source, 10, 10)).toEqual({ box, rect: box })
  })

  it('leaves out border and padding', () => {
    const source = mockSource(100, 50)
    source.style.border = '2px solid'
    source.style.padding = '3px 5px'
    const box = { left: 7, top: 5, width: 86, height: 40 }
    expect(sourceLayout(source, 10, 10)).toEqual({ box, rect: box })
  })

  it('applies object-fit and object-position', () => {
    // 16:9 frame in a 100x100 box: contain puts bars above and below.
    const video = mockVideo(160, 90)
    expect(sourceLayout(video, 160, 90).rect).toEqual({
      left: 0,
      top: 21.875,
      width: 100,
      height: 56.25,
    })
    video.style.objectPosition = 'left bottom'
    expect(sourceLayout(video, 160, 90).rect.top).toBe(43.75)
  })
})
