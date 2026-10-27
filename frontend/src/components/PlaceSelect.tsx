import React from "react";
import { MapPin } from "lucide-react";
import type { ApiLocation } from "../types";
import { useInterfaceLanguage } from "../context/LanguageContext";
import { governorates, locationById } from "../data/heritage";
import { Select, SelectGroup } from "./Select";

interface PlaceSelectProps {
  id?: string;
  locations: ApiLocation[];
  value: string;
  onChange: (locationId: string) => void;
  "aria-labelledby"?: string;
}

/**
 * Choosing a place, grouped under its governorate. The search finds a place
 * by its Arabic or English name, or every place in a governorate by its name.
 */
export const PlaceSelect: React.FC<PlaceSelectProps> = ({ id, locations, value, onChange, "aria-labelledby": labelledBy }) => {
  const { isArabic } = useInterfaceLanguage();
  const known = new Set(governorates.map((governorate) => governorate.id));
  const option = (location: ApiLocation, governorateNames: string) => {
    const arabicName = locationById(location.id)?.arabicName ?? location.arabicName ?? location.name;
    return {
      value: location.id,
      label: isArabic ? arabicName : location.name,
      keywords: `${location.name} ${arabicName} ${governorateNames}`,
    };
  };
  const groups: SelectGroup[] = governorates
    .map((governorate) => ({
      label: isArabic ? governorate.arabicName : governorate.name,
      options: locations
        .filter((location) => (location.governorateId ?? "jerusalem") === governorate.id)
        .map((location) => option(location, `${governorate.name} ${governorate.arabicName}`)),
    }))
    .filter((group) => group.options.length);
  const elsewhere = locations.filter((location) => !known.has(location.governorateId ?? "jerusalem"));
  if (elsewhere.length) {
    groups.push({ label: isArabic ? "أماكن أخرى" : "Other places", options: elsewhere.map((location) => option(location, "")) });
  }

  return (
    <Select
      id={id}
      value={value}
      onChange={onChange}
      groups={groups}
      searchable
      icon={<MapPin className="h-4 w-4" />}
      placeholder={isArabic ? "اختر مكاناً…" : "Choose a place…"}
      searchPlaceholder={isArabic ? "ابحث باسم المكان أو المحافظة" : "Search by place or governorate"}
      emptyText={isArabic ? "لا يوجد مكان بهذا الاسم بعد" : "No place by that name yet"}
      aria-labelledby={labelledBy}
    />
  );
};
