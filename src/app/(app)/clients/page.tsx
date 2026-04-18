import {
  Empty,
  EmptyHeader,
  EmptyTitle,
  EmptyDescription,
} from "@/components/ui/empty";
import { PageHeader } from "@/components/page-header";

export default function ClientsPage() {
  return (
    <div className="flex flex-col h-full">
      <PageHeader title="Clients" />
      <div className="flex-1 overflow-y-auto">
        <div className="px-4 md:px-6 py-6 mx-auto w-full max-w-6xl">
          <Empty>
            <EmptyHeader>
              <EmptyTitle>Coming soon</EmptyTitle>
              <EmptyDescription>Client management is on the way.</EmptyDescription>
            </EmptyHeader>
          </Empty>
        </div>
      </div>
    </div>
  );
}
