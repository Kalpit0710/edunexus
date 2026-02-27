export default function ParentLayout({ children }: { children: React.ReactNode }) {
  return <div className="flex min-h-screen"><main className="flex-1 overflow-auto">{children}</main></div>
}
