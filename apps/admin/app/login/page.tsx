import { AuthForm } from "../components/auth-form";

export default function LoginPage() {
  return (
    <main className="auth-page">
      <p className="eyebrow">Structo CMS</p>
      <h1>Welcome back.</h1>
      <p className="intro">
        Log in to enter your organization and site dashboards.
      </p>
      <AuthForm mode="login" />
    </main>
  );
}
