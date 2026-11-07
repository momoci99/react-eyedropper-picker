import { act, render, screen } from '@testing-library/react'
import { createRef } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ImageColorPicker } from '../src/loupe'
import {
  getOverlay,
  gridBuffer,
  gridHex,
  key,
  mockCanvas,
  mockFrames,
} from './loupe-mocks'
import {
  FakeAudioContext,
  mockAudioContext,
  resetAudioContext,
} from './audio-mocks'

let frames: ReturnType<typeof mockFrames>

/** jsdom loads no images: fake a loaded 10x10 image shown at 100x100. */
const mockLoadedImages = () => {
  const proto = HTMLImageElement.prototype
  vi.spyOn(proto, 'complete', 'get').mockReturnValue(true)
  vi.spyOn(proto, 'naturalWidth', 'get').mockReturnValue(10)
  vi.spyOn(proto, 'naturalHeight', 'get').mockReturnValue(10)
  vi.spyOn(proto, 'getBoundingClientRect').mockReturnValue({
    left: 0,
    top: 0,
    width: 100,
    height: 100,
    right: 100,
    bottom: 100,
    x: 0,
    y: 0,
    toJSON: () => ({}),
  })
}

beforeEach(() => {
  mockCanvas(gridBuffer(10, 10))
  frames = mockFrames()
  mockLoadedImages()
})

afterEach(() => {
  vi.restoreAllMocks()
  document.body.innerHTML = ''
})

const image = () => screen.getByRole('button')

const hoverAt = (x: number, y: number) => {
  const init = { clientX: x, clientY: y, pointerType: 'mouse', bubbles: true }
  image().dispatchEvent(new PointerEvent('pointerover', init))
  image().dispatchEvent(new PointerEvent('pointermove', init))
}

const clickAt = (x: number, y: number) =>
  image().dispatchEvent(
    new MouseEvent('click', { clientX: x, clientY: y, bubbles: true })
  )

const hoverLoupe = () =>
  document.querySelector<HTMLElement>('[aria-hidden="true"]')

describe('ImageColorPicker', () => {
  it('renders a focusable image with a label', () => {
    render(<ImageColorPicker src="a.png" alt="Sunset" className="photo" />)
    const img = image()
    expect(img.tagName).toBe('IMG')
    expect(img).toHaveAttribute('tabindex', '0')
    expect(img).toHaveAttribute('aria-label', 'Pick a color from Sunset')
    expect(img).toHaveClass('photo')
    expect(img.style.touchAction).toBe('none')
  })

  it('forwards the ref', () => {
    const ref = createRef<HTMLImageElement>()
    render(<ImageColorPicker src="a.png" alt="" ref={ref} />)
    expect(ref.current).toBe(image())
  })

  it('picks with hover and click', () => {
    const onPick = vi.fn()
    render(<ImageColorPicker src="a.png" alt="" onPick={onPick} />)
    hoverAt(35, 45)
    frames.flush()
    expect(hoverLoupe()).toBeInTheDocument()
    clickAt(35, 45)
    expect(onPick).toHaveBeenCalledWith({
      sRGBHex: gridHex(3, 4),
      x: 3,
      y: 4,
      mode: 'loupe',
    })
  })

  it('passes the cursor option to the hover and keyboard loupes', () => {
    render(<ImageColorPicker src="a.png" alt="" loupe={{ cursor: 'copy' }} />)
    hoverAt(35, 45)
    expect(image().style.cursor).toBe('copy')
    image().dispatchEvent(
      new PointerEvent('pointerleave', { pointerType: 'mouse' })
    )
    expect(image().style.cursor).toBe('crosshair')
    act(() => image().focus())
    key('Enter')
    frames.flush()
    expect(getOverlay()!.style.cursor).toBe('copy')
  })

  it('opens the full-screen loupe with Enter', async () => {
    const onPick = vi.fn()
    render(<ImageColorPicker src="a.png" alt="" onPick={onPick} />)
    act(() => image().focus())
    key('Enter')
    expect(getOverlay()).toBeInTheDocument()
    key('ArrowRight')
    key('Enter')
    await vi.waitFor(() =>
      expect(onPick).toHaveBeenCalledWith(
        expect.objectContaining({ x: 6, y: 5 })
      )
    )
    expect(getOverlay()).toBeNull()
    expect(document.activeElement).toBe(image())
  })

  it('does not report Escape as an error', async () => {
    const onPickError = vi.fn()
    render(<ImageColorPicker src="a.png" alt="" onPickError={onPickError} />)
    act(() => image().focus())
    key(' ')
    key('Escape')
    // Let the rejection handler run.
    await new Promise((r) => setTimeout(r, 0))
    expect(getOverlay()).toBeNull()
    expect(onPickError).not.toHaveBeenCalled()
  })

  it('renders renderLabel into the loupe', () => {
    render(
      <ImageColorPicker
        src="a.png"
        alt=""
        loupe={{
          renderLabel: (c) => <b data-testid="label">{c.sRGBHex}</b>,
        }}
      />
    )
    hoverAt(35, 45)
    act(() => frames.flush())
    const label = screen.getByTestId('label')
    expect(label).toHaveTextContent(gridHex(3, 4))
    expect(hoverLoupe()).toContainElement(label)

    hoverAt(55, 45)
    act(() => frames.flush())
    expect(label).toHaveTextContent(gridHex(5, 4))
  })

  it('reports a cross-origin read error', () => {
    vi.mocked(HTMLCanvasElement.prototype.getContext).mockImplementation(
      () =>
        ({
          drawImage: () => {},
          getImageData: () => {
            throw new DOMException('tainted', 'SecurityError')
          },
        }) as never
    )
    const onPickError = vi.fn()
    render(<ImageColorPicker src="a.png" alt="" onPickError={onPickError} />)
    hoverAt(35, 45)
    expect(onPickError).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'SecurityError' })
    )
    expect(hoverLoupe()).toBeNull()
  })

  it('zooms in controlled mode through the prop', () => {
    const onChange = vi.fn()
    const view = (magnification: number) => (
      <ImageColorPicker
        src="a.png"
        alt=""
        loupe={{ magnification, onMagnificationChange: onChange }}
      />
    )
    const { rerender } = render(view(8))
    hoverAt(35, 45)
    image().dispatchEvent(
      new WheelEvent('wheel', { deltaY: -100, cancelable: true })
    )
    expect(onChange).toHaveBeenLastCalledWith(8.8)
    rerender(view(16))
    image().dispatchEvent(
      new WheelEvent('wheel', { deltaY: -100, cancelable: true })
    )
    expect(onChange).toHaveBeenLastCalledWith(17.6)
  })

  it('keeps an uncontrolled zoom for the keyboard loupe', () => {
    const onChange = vi.fn()
    render(
      <ImageColorPicker
        src="a.png"
        alt=""
        loupe={{ onMagnificationChange: onChange }}
      />
    )
    hoverAt(35, 45)
    image().dispatchEvent(
      new WheelEvent('wheel', { deltaY: -100, cancelable: true })
    )
    act(() => image().focus())
    key('Enter')
    key('+')
    expect(onChange.mock.calls).toEqual([[8.8], [9.68]])
  })

  it('removes the loupe on unmount', () => {
    const { unmount } = render(<ImageColorPicker src="a.png" alt="" />)
    hoverAt(35, 45)
    expect(hoverLoupe()).toBeInTheDocument()
    unmount()
    expect(hoverLoupe()).toBeNull()
  })
})

describe('ImageColorPicker sound', () => {
  beforeEach(() => mockAudioContext())
  afterEach(() => resetAudioContext())

  const pointerDown = () =>
    image().dispatchEvent(
      new PointerEvent('pointerdown', { pointerType: 'mouse', bubbles: true })
    )

  it('plays confirm on a hover pick after a pointerdown', () => {
    const confirm = vi.fn()
    render(
      <ImageColorPicker
        src="a.png"
        alt=""
        loupe={{ sound: { play: { confirm } } }}
      />
    )
    hoverAt(35, 45)
    pointerDown()
    clickAt(35, 45)
    expect(confirm).toHaveBeenCalledTimes(1)
  })

  it('calls the latest inline player without rebuilding', () => {
    const first = vi.fn()
    const second = vi.fn()
    const { rerender } = render(
      <ImageColorPicker
        src="a.png"
        alt=""
        loupe={{ sound: { play: { confirm: first } } }}
      />
    )
    rerender(
      <ImageColorPicker
        src="a.png"
        alt=""
        loupe={{ sound: { play: { confirm: second } } }}
      />
    )
    hoverAt(35, 45)
    pointerDown()
    clickAt(35, 45)
    expect(first).not.toHaveBeenCalled()
    expect(second).toHaveBeenCalledTimes(1)
    // One output gain: the engine was not rebuilt.
    expect(FakeAudioContext.instances[0]!.gains).toHaveLength(1)
  })

  it('plays open on the keyboard loupe', () => {
    const open = vi.fn()
    render(
      <ImageColorPicker
        src="a.png"
        alt=""
        loupe={{ sound: { play: { open } } }}
      />
    )
    act(() => image().focus())
    key('Enter')
    expect(open).toHaveBeenCalledTimes(1)
    key('Escape')
  })

  it('stops when sound is turned off', () => {
    const confirm = vi.fn()
    const { rerender } = render(
      <ImageColorPicker
        src="a.png"
        alt=""
        loupe={{ sound: { play: { confirm } } }}
      />
    )
    rerender(<ImageColorPicker src="a.png" alt="" loupe={{ sound: false }} />)
    hoverAt(35, 45)
    pointerDown()
    clickAt(35, 45)
    expect(confirm).not.toHaveBeenCalled()
  })
})
