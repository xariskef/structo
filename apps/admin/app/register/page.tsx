import { AuthForm } from "../components/auth-form";

export default function RegisterPage() {
  return (
    <main className="auth-page">
      <p className="eyebrow">Structo CMS</p>
      <h1>Create your workspace.</h1>
      <p className="intro">
        Registration creates your first organization and owner access.
      </p>
      <AuthForm mode="register" />
    </main>
  );
}
