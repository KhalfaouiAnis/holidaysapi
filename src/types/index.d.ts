interface IProperty {
  id: string;
  name: string;
  description: string;
  price_per_night: number;
  address: string;
  city: string;
  country: string;
  amenities: string;
  capacity: number;
  images: string[];
  longitude: number;
  latitude: number;
  longitude_delta: number;
  latitude_delta: number;
}
