import { login } from './actions'

export default async function Login({ searchParams }: { searchParams: Promise<{error?: string}> }) {
  const params = await searchParams
  return <main className="loginShell">
    <div className="loginCard">
      <div className="eyebrow">SRI CINE HUB STAFF</div>
      <h1>Operations login</h1>
      <p>Bookings, inventory, checkout, returns and investor reporting are restricted to authorized users.</p>
      {params.error && <div className="errorBox">{params.error}</div>}
      <form action={login} className="quoteForm">
        <label>Email<input name="email" type="email" required /></label>
        <label>Password<input name="password" type="password" required /></label>
        <button className="button gold" type="submit">Sign in</button>
      </form>
    </div>
  </main>
}
