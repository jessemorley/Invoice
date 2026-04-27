import { EntriesView } from "@/components/entries-view";

export default function EntriesLoading() {
  return <EntriesView entries={[]} clients={[]} workflowRates={[]} loading />;
}
