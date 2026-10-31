import { signIn } from "@/server/auth"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

export default function LoginPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-bg p-4">
      <Card className="w-full max-w-sm">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl">Open Drive</CardTitle>
          <CardDescription>Sign in to access the portal</CardDescription>
        </CardHeader>
        <CardContent>
          <form
            action={async () => {
              "use server"
              await signIn("google")
            }}
          >
            <Button type="submit" className="w-full">
              Continue with Google
            </Button>
          </form>
          <p className="mt-4 text-center text-sm text-text-muted">
            Uses your email and profile to set up your account.
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
