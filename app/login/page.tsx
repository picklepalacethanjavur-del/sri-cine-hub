import { LoginForm } from "./LoginForm";

export default async function Login({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const params = await searchParams;
  return (
    <main className="loginShell">
      <div className="loginCard">
        <div className="eyebrow">SRI CINE HUB STAFF</div>
        <h1>Operations login</h1>
        <p>Bookings, inventory, checkout, returns and investor reporting are restricted to authorized users.</p>
        <LoginForm error={params.error} />
      </div>
    </main>
  );
}
