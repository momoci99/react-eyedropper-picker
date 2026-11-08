import { ColorPicker } from 'react-eyedropper-picker'

export default function HistoryPicker() {
  return (
    <ColorPicker
      theme="auto"
      defaultValue="#0ea5e9"
      history={{ defaultColors: ['#f43f5e', '#f59e0b', '#10b981', '#6366f1'] }}
    />
  )
}
