export type EquipmentCategory = "Cameras" | "Lenses" | "Lights" | "Accessories" | "Grip" | "Transport" | "Genset" | "Post Production";

export type EquipmentItem = {
  id: string;
  name: string;
  category: EquipmentCategory;
  description: string;
  featured?: boolean;
};

export type BookingStatus = "QUOTE" | "RESERVED" | "CONFIRMED" | "PREPARING" | "CHECKED_OUT" | "OVERDUE" | "RETURNED" | "CLOSED" | "CANCELLED";

export type Booking = {
  id: string;
  client: string;
  project: string;
  start: string;
  end: string;
  status: BookingStatus;
  cameraIds: string[];
  total: number;
  balance: number;
};
