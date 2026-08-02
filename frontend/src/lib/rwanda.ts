export interface RwandaDistrict {
  name: string;
}

export interface RwandaProvince {
  name: string;
  districts: string[];
}

export const RWANDA_PROVINCES: RwandaProvince[] = [
  {
    name: 'Kigali City',
    districts: ['Gasabo', 'Kicukiro', 'Nyarugenge'],
  },
  {
    name: 'Northern Province',
    districts: ['Burera', 'Gakenke', 'Gicumbi', 'Musanze', 'Rulindo'],
  },
  {
    name: 'Southern Province',
    districts: ['Gisagara', 'Huye', 'Kamonyi', 'Muhanga', 'Nyamagabe', 'Nyanza', 'Nyaruguru', 'Ruhango'],
  },
  {
    name: 'Eastern Province',
    districts: ['Bugesera', 'Gatsibo', 'Kayonza', 'Kirehe', 'Ngoma', 'Nyagatare', 'Rwamagana'],
  },
  {
    name: 'Western Province',
    districts: ['Karongi', 'Ngororero', 'Nyabihu', 'Nyamasheke', 'Rubavu', 'Rusizi', 'Rutsiro'],
  },
];

export function getDistrictsForProvince(province: string): string[] {
  return RWANDA_PROVINCES.find((p) => p.name === province)?.districts ?? [];
}

export const DELIVERY_FEES: Record<string, number> = {
  'Kigali City': 2000,
  'Northern Province': 5000,
  'Southern Province': 5000,
  'Eastern Province': 5000,
  'Western Province': 5000,
};

export function getDeliveryFee(province: string): number {
  return DELIVERY_FEES[province] ?? 5000;
}
