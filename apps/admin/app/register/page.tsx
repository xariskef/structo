import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@structo/ui/components/card";

import { AuthForm } from "../components/auth-form";
import { Logo } from "../components/logo";

export default function RegisterPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/40 px-4">
      <div className="w-full max-w-sm">
        <div className="mb-6 flex justify-center">
          <Logo size={32} className="text-foreground" />
        </div>
        <Card>
          <CardHeader className="pb-4">
            <CardTitle>
              <h1 className="text-xl">Create your workspace</h1>
            </CardTitle>
            <CardDescription>
              Registration creates your account and first organization.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <AuthForm mode="register" />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
