import { redirect } from 'next/navigation';

/* Auth forms live as views on the landing page, but /login is a URL
   people type by habit (and 404'd before this). Server-side redirect
   straight into the login view. */
export default function LoginRedirect() {
  redirect('/?view=login');
}
