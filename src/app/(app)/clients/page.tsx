import {
  Empty,
  EmptyHeader,
  EmptyTitle,
  EmptyDescription,
} from "@/components/ui/empty";

export default function ClientsPage() {
  return (
    <div className="flex flex-col h-full">
      <div className="px-4 py-4 md:px-6 border-b border-border">
        <h1 className="text-lg font-semibold text-foreground">Clients</h1>
      </div>
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-3xl mx-auto px-4 md:px-6 py-6">
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
