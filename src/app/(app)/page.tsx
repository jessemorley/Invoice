import { ViewSwitch } from "@/components/view-switch";
import { getAuthUser } from "@/lib/auth";

// No view data in the HTML: the service worker caches this page, so anything
// embedded here would be a stale copy. ViewSwitch fills views from IndexedDB
// and the browser loaders instead.
export default async function AppPage() {
  const { id, email, name } = await getAuthUser();
  return <ViewSwitch userId={id} userEmail={email} userName={name} />;
}
