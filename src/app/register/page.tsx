import { redirect } from 'next/navigation';

/* Mirror of /login — see that file. */
export default function RegisterRedirect() {
  redirect('/?view=register');
}
