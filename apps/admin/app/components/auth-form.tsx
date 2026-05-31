"use client";

import { Button } from "@structo/ui/components/button";
import { Input } from "@structo/ui/components/input";
import { Label } from "@structo/ui/components/label";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { type FormEvent, useState } from "react";

import { apiRequest } from "../lib/api";

interface AuthFormProps {
  mode: "login" | "register";
}

export function AuthForm({ mode }: AuthFormProps) {
  const router = useRouter();
  const [error, setError] = useState<string>();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const isRegister = mode === "register";

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(undefined);
    setIsSubmitting(true);

    const formData = new FormData(event.currentTarget);

    try {
      await apiRequest(
        `/manage/auth/${isRegister ? "register" : "login"}`,
        {
          method: "POST",
          body: JSON.stringify(
            isRegister
              ? {
                  email: formData.get("email"),
                  name: formData.get("name"),
                  organizationName: formData.get("organizationName"),
                  organizationSlug: formData.get("organizationSlug"),
                  password: formData.get("password"),
                }
              : {
                  email: formData.get("email"),
                  password: formData.get("password"),
                },
          ),
        },
      );

      router.push("/dashboard");
      router.refresh();
    } catch (nextError) {
      setError(
        nextError instanceof Error
          ? nextError.message
          : "The request could not be completed.",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-4">
      {isRegister && (
        <>
          <div className="grid gap-1.5">
            <Label htmlFor="name">Your name</Label>
            <Input id="name" name="name" autoComplete="name" required />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="organizationName">Organization name</Label>
            <Input id="organizationName" name="organizationName" required />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="organizationSlug">
              Organization slug{" "}
              <span className="font-normal text-muted-foreground">
                (lowercase, hyphens only)
              </span>
            </Label>
            <Input
              id="organizationSlug"
              name="organizationSlug"
              pattern="[a-z0-9]+(?:-[a-z0-9]+)*"
              placeholder="my-organization"
              required
            />
          </div>
        </>
      )}

      <div className="grid gap-1.5">
        <Label htmlFor="email">Email</Label>
        <Input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          required
        />
      </div>

      <div className="grid gap-1.5">
        <Label htmlFor="password">Password</Label>
        <Input
          id="password"
          name="password"
          type="password"
          autoComplete={isRegister ? "new-password" : "current-password"}
          minLength={12}
          required
        />
      </div>

      {error && (
        <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </p>
      )}

      <Button type="submit" disabled={isSubmitting} className="w-full">
        {isSubmitting
          ? "Working…"
          : isRegister
            ? "Create account"
            : "Log in"}
      </Button>

      <p className="text-center text-sm text-muted-foreground">
        {isRegister ? "Already registered? " : "Need an account? "}
        <Link
          href={isRegister ? "/login" : "/register"}
          className="font-medium text-foreground underline-offset-4 hover:underline"
        >
          {isRegister ? "Log in" : "Register"}
        </Link>
      </p>
    </form>
  );
}
