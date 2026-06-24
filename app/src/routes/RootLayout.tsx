import { Outlet } from '@tanstack/react-router'

export function RootLayout() {
  return (
    <div className="flex h-full min-h-0 flex-col">
      <Outlet />
    </div>
  )
}
