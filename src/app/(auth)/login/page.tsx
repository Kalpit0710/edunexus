export default function LoginPage() {
  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <div className="w-full max-w-md space-y-6 rounded-2xl bg-white p-8 shadow-xl dark:bg-gray-900">
        <div className="space-y-2 text-center">
          <h1 className="text-3xl font-bold tracking-tight">EduNexus</h1>
          <p className="text-muted-foreground">Sign in to your school management system</p>
        </div>
        {/* LoginForm will be built in Milestone 1.3 */}
        <p className="text-center text-sm text-muted-foreground">
          Auth module coming in Milestone 1.3
        </p>
      </div>
    </div>
  )
}
