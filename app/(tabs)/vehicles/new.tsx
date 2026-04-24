import { useRouter } from 'expo-router';

import { VehicleForm, type VehicleFormValue } from '@/components/vehicle-form';
import { useAuth } from '@/hooks/use-auth';
import { createVehicle } from '@/services/vehicles';
import type { Vehicle } from '@/types/vehicle';

export default function VehicleBuilderScreen() {
  const router = useRouter();
  const { user } = useAuth();

  async function handleSubmit(value: VehicleFormValue) {
    if (!user) {
      throw new Error(
        'Sign in required before saving. Enable Email/Password in Firebase Auth, then sign in.',
      );
    }
    const ownerDisplayName = user.displayName?.trim() || undefined;
    const input: Omit<Vehicle, 'id' | 'createdAt' | 'updatedAt'> = {
      ownerId: user.uid,
      ownerDisplayName,
      year: value.year,
      make: value.make,
      model: value.model,
      trim: value.trim,
      nickname: value.nickname,
      vin: value.vin,
      story: value.story,
      mileage: value.mileage,
      exteriorColor: value.exteriorColor,
      interiorColor: value.interiorColor,
      location: value.location,
      builder: value.builder,
      modifications: value.modifications ?? [],
      ownershipHistory: value.ownershipHistory,
      buildSheet: value.buildSheet,
      mediaIds: [],
      visibility: value.visibility ?? 'private',
      oemSpecs: value.oemSpecs,
    };
    const newId = await createVehicle(input);
    router.replace(`/vehicles/${newId}`);
  }

  return (
    <VehicleForm
      title="Vehicle Builder"
      submitLabel="Save vehicle"
      signedIn={!!user}
      onSubmit={handleSubmit}
      onCancel={() => router.back()}
    />
  );
}
