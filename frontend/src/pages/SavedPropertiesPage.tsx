import { Heart } from "lucide-react";
import { useNavigate } from "react-router-dom";

import PropertyCard from "@/components/PropertyCard";
import type { Property } from "@/types";

interface SavedPropertiesPageProps {
  properties: Property[];
  onToggleSave: (id: number) => void;
}

function SavedPropertiesPage({
  properties,
  onToggleSave,
}: SavedPropertiesPageProps) {
  const navigate = useNavigate();
  const savedProperties = properties.filter((property) => property.saved);

  return (
    <main className="mx-auto min-h-[calc(100svh-3.5rem)] max-w-6xl px-4 py-8">
      <div className="flex items-center gap-3">
        <span className="grid size-11 place-items-center rounded-xl bg-primary/10 text-primary">
          <Heart />
        </span>
        <div>
          <h1 className="text-2xl font-semibold">관심 매물</h1>
          <p className="text-sm text-muted-foreground">
            저장한 매물 {savedProperties.length}건을 모아봤어요.
          </p>
        </div>
      </div>
      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {savedProperties.map((property) => (
          <PropertyCard
            key={property.id}
            property={property}
            onToggleSave={onToggleSave}
            onOpen={(id) => navigate(`/properties/${id}`)}
          />
        ))}
      </div>
    </main>
  );
}

export default SavedPropertiesPage;
