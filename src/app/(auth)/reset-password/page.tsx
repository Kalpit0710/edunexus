export default function ResetPasswordPage() {
  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <div className="w-full max-w-md space-y-6 rounded-2xl bg-white p-8 shadow-xl dark:bg-gray-900">
        <div className="space-y-2 text-center">
          <h1 className="text-2xl font-bold tracking-tight">Reset Password</h1>
          <p className="text-muted-foreground">Enter your email to receive a reset link</p>
        </div>
        {/* ResetPasswordForm will be built in Milestone 1.3 */}
        <p className="text-center text-sm text-muted-foreground">
          Auth module coming in Milestone 1.3
        </p>
      </div>
    </div>
  )
}
