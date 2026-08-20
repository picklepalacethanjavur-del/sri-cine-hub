"use client";
import { useFormStatus } from "react-dom";
import { login } from "./actions";

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <>
      {pending && <div className="loginProgressBar" />}
      <button className="button gold" type="submit" disabled={pending}>
        {pending ? "Signing in…" : "Sign in"}
      </button>
    </>
  );
}

export function LoginForm({ error }: { error?: string }) {
  return (
    <form action={login} className="quoteForm">
      {error && <div className="errorBox">{error}</div>}
      <label>Email<input name="email" type="email" required autoComplete="email" /></label>
      <label>Password<input name="password" type="password" required autoComplete="current-password" /></label>
      <SubmitButton />
    </form>
  );
}
