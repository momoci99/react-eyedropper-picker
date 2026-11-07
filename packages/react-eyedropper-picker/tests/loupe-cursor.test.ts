import { describe, expect, it } from 'vitest'
import { eyeDropperCursor } from '../src/loupe'

describe('eyeDropperCursor', () => {
  it('is an SVG data URL with the hotspot on the tip and a fallback', () => {
    expect(eyeDropperCursor).toMatch(
      /^url\("data:image\/svg\+xml,[^"]+"\) 3 23, crosshair$/
    )
  })

  it('holds a valid SVG with the outlined icon', () => {
    const data = /^url\("data:image\/svg\+xml,([^"]+)"\)/.exec(
      eyeDropperCursor
    )!
    const svg = new DOMParser().parseFromString(
      decodeURIComponent(data[1]!),
      'image/svg+xml'
    )
    expect(svg.querySelector('parsererror')).toBeNull()
    const groups = svg.querySelectorAll('g')
    expect([...groups].map((g) => g.getAttribute('stroke'))).toEqual([
      'white',
      'black',
    ])
    expect(groups[0]!.querySelectorAll('path')).toHaveLength(3)
  })
})
