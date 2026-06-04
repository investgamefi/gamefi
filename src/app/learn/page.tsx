/* Legacy /learn route — redirects to /training?tab=reference so bookmarks
   to the old Academy land on the Reference tab of the merged page. */

import { redirect } from 'next/navigation';

export default function LearnRedirect() {
  redirect('/training?tab=reference');
}
