import { Card, CardContent } from "@/components/ui/card";

export default function ClientsPage() {
  return (
    <div className="flex flex-col h-full">
      <div className="px-4 py-4 md:px-6 border-b border-border">
        <h1 className="text-lg font-semibold text-foreground">Clients</h1>
      </div>
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-3xl mx-auto px-4 md:px-6 py-6">
          <Card>
            <CardContent className="flex items-center justify-center h-48 text-muted-foreground text-sm">
              Coming soon
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
