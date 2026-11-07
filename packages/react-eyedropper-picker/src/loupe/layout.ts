import { fitRect, type DisplayRect } from './geometry'
import type { LoupeSource } from './pixels'

/** Where a source's pixels are on screen. */
export type SourceLayout = {
  /** The content box: visible area (inside border and padding). */
  box: DisplayRect
  /** The picture inside `box` after `object-fit` / `object-position`. */
  rect: DisplayRect
}

/**
 * Reads where `source` draws its `width` x `height` pixels: the content box
 * from `getBoundingClientRect()` minus border and padding, then CSS
 * `object-fit` and `object-position`. Ignores CSS transforms other than
 * translation.
 */
export const sourceLayout = (
  source: LoupeSource,
  width: number,
  height: number
): SourceLayout => {
  const r = source.getBoundingClientRect()
  const style = source.ownerDocument.defaultView!.getComputedStyle(source)
  const px = (v: string) => parseFloat(v) || 0
  const left = px(style.borderLeftWidth) + px(style.paddingLeft)
  const top = px(style.borderTopWidth) + px(style.paddingTop)
  const right = px(style.borderRightWidth) + px(style.paddingRight)
  const bottom = px(style.borderBottomWidth) + px(style.paddingBottom)
  const box = {
    left: r.left + left,
    top: r.top + top,
    width: Math.max(0, r.width - left - right),
    height: Math.max(0, r.height - top - bottom),
  }
  return {
    box,
    rect: fitRect(box, width, height, style.objectFit, style.objectPosition),
  }
}
