'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useSession } from './SessionProvider';
import { Button } from './ui/Button';

const NAV_BY_ROLE: Record<string, { href: string; label: string }[]> = {
  patient: [
    { href: '/dashboard', label: 'My Appointments' },
    { href: '/dashboard/doctors', label: 'Find a Doctor' },
    { href: '/dashboard/medications', label: 'Medications' },
  ],
  doctor: [
    { href: '/dashboard', label: 'My Schedule' },
  ],
  admin: [
    { href: '/dashboard', label: 'Overview' },
    { href: '/dashboard/admin/doctors', label: 'Doctors' },
    { href: '/dashboard/admin/notifications', label: 'Notifications' },
  ],
};

export function Navbar() {
  const { user, setUser } = useSession();
  const pathname = usePathname();
  const router = useRouter();

  const links = user ? NAV_BY_ROLE[user.role] || [] : [];

  async function logout() {
    await fetch('/api/auth/logout', { method: 'POST' });
    setUser(null);
    router.push('/login');
  }

  return (
    <header className="sticky top-0 z-20 border-b border-border bg-white">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
        <Link href={user ? '/dashboard' : '/'} className="flex items-center gap-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand text-white">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path
                d="M12 3v7m0 0v7m0-7h7m-7 0H5"
                stroke="currentColor"
                strokeWidth="2.4"
                strokeLinecap="round"
              />
            </svg>
          </span>
          <span className="text-base font-semibold text-ink">CareLine Clinic</span>
        </Link>

        {links.length > 0 && (
          <nav className="hidden items-center gap-1 md:flex">
            {links.map((l) => {
              const active = l.href === '/dashboard' ? pathname === l.href : pathname?.startsWith(l.href);
              return (
                <Link
                  key={l.href}
                  href={l.href}
                  className={`rounded-md px-3 py-2 text-sm font-medium ${
                    active ? 'text-brand' : 'text-navtext hover:text-brand'
                  }`}
                >
                  {l.label}
                </Link>
              );
            })}
          </nav>
        )}

        <div className="flex items-center gap-3">
          {user ? (
            <>
              {user.role === 'patient' && (
                <Link href="/dashboard/doctors">
                  <Button size="sm">Book Appointment</Button>
                </Link>
              )}
              <span className="hidden text-sm text-navtext sm:inline">{user.name}</span>
              <Button size="sm" variant="ghost" onClick={logout}>
                Log out
              </Button>
            </>
          ) : (
            <>
              <Link href="/login">
                <Button size="sm" variant="secondary">
                  Log in
                </Button>
              </Link>
              <Link href="/register">
                <Button size="sm">Sign up</Button>
              </Link>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
