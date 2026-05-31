"use client";

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
      await apiRequest(`/manage/auth/${isRegister ? "register" : "login"}`, {
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
      });

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
    <form className="auth-form" onSubmit={submit}>
      {isRegister ? (
        <>
          <label>
            Your name
            <input autoComplete="name" name="name" required />
          </label>
          <label>
            Organization name
            <input name="organizationName" required />
          </label>
          <label>
            Organization slug
            <input
              name="organizationSlug"
              pattern="[a-z0-9]+(?:-[a-z0-9]+)*"
              required
            />
          </label>
        </>
      ) : null}
      <label>
        Email
        <input autoComplete="email" name="email" required type="email" />
      </label>
      <label>
        Password
        <input
          autoComplete={isRegister ? "new-password" : "current-password"}
          minLength={12}
          name="password"
          required
          type="password"
        />
      </label>
      {error ? <p className="form-error">{error}</p> : null}
      <button disabled={isSubmitting} type="submit">
        {isSubmitting ? "Working..." : isRegister ? "Create account" : "Log in"}
      </button>
      <p>
        {isRegister ? "Already registered? " : "Need an account? "}
        <Link href={isRegister ? "/login" : "/register"}>
          {isRegister ? "Log in" : "Register"}
        </Link>
      </p>
    </form>
  );
}
