import { Heart } from "lucide-react";
import { useNavigate } from "react-router-dom";

import PropertyCard, { type PropertyCardItem } from "@/components/PropertyCard";
import type { Property } from "@/types";

// 관심 매물은 아직 백엔드 API가 없어 App이 들고 있는 목데이터를 그대로 카드 뷰모델로 옮긴다
function toCardItem(property: Property): PropertyCardItem {
  return {
    id: property.id,
    title: property.title,
    dealType: property.dealType,
    roomType: property.buildingType,
    region: property.region,
    dong: property.dong,
    deposit: property.deposit,
    monthlyRent: property.monthlyRent,
    area: property.areaM2,
    floor: property.floor,
    totalFloor: property.totalFloors,
    imageUrl: property.imageUrl,
    saved: property.saved,
  };
}

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
            property={toCardItem(property)}
            onToggleSave={onToggleSave}
            onOpen={(id) => navigate(`/properties/${id}`)}
          />
        ))}
      </div>
    </main>
  );
}

export default SavedPropertiesPage;
