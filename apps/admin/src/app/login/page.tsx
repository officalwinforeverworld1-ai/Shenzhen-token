"use client";

import { useActionState } from "react";
import { loginAction } from "@/lib/actions";

export default function LoginPage() {
  const [state, formAction, isPending] = useActionState(loginAction, null);

  return (
    <div className="login-container">
      <div className="login-card">
        <h1>Shén Zhèn</h1>
        <p className="subtitle">Admin Panel</p>

        {state?.error && (
          <div className="alert alert-error">{state.error}</div>
        )}

        <form action={formAction}>
          <div className="form-group">
            <label htmlFor="username">Username</label>
            <input
              id="username"
              name="username"
              type="text"
              required
              autoComplete="username"
              placeholder="admin"
            />
          </div>

          <div className="form-group">
            <label htmlFor="password">Password</label>
            <input
              id="password"
              name="password"
              type="password"
              required
              autoComplete="current-password"
              placeholder="••••••••"
            />
          </div>

          <button
            type="submit"
            className="btn btn-primary btn-full"
            disabled={isPending}
          >
            {isPending ? "Signing in..." : "Sign In"}
          </button>
        </form>
      </div>
    </div>
  );
}
