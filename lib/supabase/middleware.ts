import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

// `cookies` é uma união de dois formatos no @supabase/ssr, então o TS não
// consegue inferir o parâmetro sozinho — daí a anotação explícita.
type CookiesToSet = { name: string; value: string; options: CookieOptions }[];

export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet: CookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const { data: { user } } = await supabase.auth.getUser();

  // Protege rotas: sem sessão -> login
  const path = request.nextUrl.pathname;
  const publica = path.startsWith('/login') || path.startsWith('/_next') || path.startsWith('/manifest') || path === '/favicon.ico';
  if (!user && !publica) {
    const url = request.nextUrl.clone();
    url.pathname = '/login';
    return NextResponse.redirect(url);
  }
  return response;
}
