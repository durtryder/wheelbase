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
    const input: Omit<Vehicle, 'id' | 'createdAt' | 'updatedAt'> = {
      ownerId: user.uid,
      year: value.year,
      make: value.make,
      model: value.model,
      trim: value.trim,
      nickname: value.nickname,
      vin: value.vin,
      mileage: value.mileage,
      exteriorColor: value.exteriorColor,
      interiorColor: value.interiorColor,
      location: value.location,
      builder: value.builder,
      modifications: value.modifications ?? [],
      ownershipHistory: value.ownershipHistory,
      mediaIds: [],
      visibility: 'private',
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
