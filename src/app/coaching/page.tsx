/* Legacy /coaching route — redirects to the merged /training surface
   (Drills tab is the default). Kept so old bookmarks and any external
   links don't break. */

import { redirect } from 'next/navigation';

export default function CoachingRedirect() {
  redirect('/training');
}
