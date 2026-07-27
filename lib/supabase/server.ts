import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { cookies } from 'next/headers';

// `cookies` é uma união de dois formatos no @supabase/ssr, então o TS não
// consegue inferir o parâmetro sozinho — daí a anotação explícita.
type CookiesToSet = { name: string; value: string; options: CookieOptions }[];

export function createClient() {
  const cookieStore = cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet: CookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // chamada em Server Component: ignorado (middleware renova a sessão)
          }
        },
      },
    }
  );
}
