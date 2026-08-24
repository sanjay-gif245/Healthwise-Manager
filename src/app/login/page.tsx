'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Navbar } from '@/components/Navbar';
import { Card, CardBody } from '@/components/ui/Card';
import { Label, Input } from '@/components/ui/Form';
import { Button } from '@/components/ui/Button';
import { Alert } from '@/components/ui/Alert';
import { useSession } from '@/components/SessionProvider';

export default function LoginPage() {
  const router = useRouter();
  const { refresh } = useSession();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Login failed');
        return;
      }
      await refresh();
      router.push('/dashboard');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-appbg">
      <Navbar />
      <main className="mx-auto flex max-w-md flex-col justify-center px-4 py-16 sm:px-6">
        <h1 className="mb-1 text-2xl font-semibold text-ink">Log in</h1>
        <p className="mb-6 text-sm text-ink-muted">Welcome back to CareLine Clinic.</p>
        <Card>
          <CardBody>
            <form onSubmit={onSubmit} className="space-y-4">
              {error && <Alert kind="error">{error}</Alert>}
              <div>
                <Label htmlFor="email">Email</Label>
                <Input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
              </div>
              <div>
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>
              <Button type="submit" className="w-full" loading={loading}>
                Log in
              </Button>
            </form>
          </CardBody>
        </Card>
        <p className="mt-4 text-center text-sm text-ink-muted">
          New patient?{' '}
          <Link href="/register" className="font-medium text-brand hover:underline">
            Create an account
          </Link>
        </p>
        <div className="mt-8 rounded-lg border border-border bg-white p-4 text-xs text-ink-muted">
          <p className="mb-1 font-semibold text-navtext">Demo accounts (after running the seed script)</p>
          <p>Admin: admin@clinic.demo / Admin@1234</p>
          <p>Doctor: anjali.rao@clinic.demo / Doctor@1234</p>
          <p>Patient: ravi.kumar@clinic.demo / Patient@1234</p>
        </div>
      </main>
    </div>
  );
}
