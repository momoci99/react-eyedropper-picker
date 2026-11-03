import type { ButtonHTMLAttributes } from 'react'

export type EyeDropperButtonProps = ButtonHTMLAttributes<HTMLButtonElement>

export const EyeDropperIcon = () => (
  <svg
    width="16"
    height="16"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <path d="m2 22 1-1h3l9-9" />
    <path d="M3 21v-3l9-9" />
    <path d="m15 6 3.4-3.4a2.1 2.1 0 1 1 3 3L18 9l.4.4a2.1 2.1 0 1 1-3 3l-3.8-3.8a2.1 2.1 0 1 1 3-3l.4.4Z" />
  </svg>
)

export const EyeDropperButton = ({
  children,
  style,
  ...rest
}: EyeDropperButtonProps) => (
  <button
    type="button"
    aria-label="Pick color from screen"
    title="Pick color from screen"
    style={{
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
      width: 32,
      height: 32,
      padding: 0,
      border: '1px solid rgba(0,0,0,.15)',
      borderRadius: 6,
      background: 'transparent',
      color: 'inherit',
      cursor: 'pointer',
      ...style,
    }}
    {...rest}
  >
    {children ?? <EyeDropperIcon />}
  </button>
)
