export interface Product {
  id: number;
  brandCode: string;
  name: string;
  description?: string;
  price: number;
  discountRate: number;
  buyPrice: number;
  tradeInRate: number;
  allowTradeIn: boolean;
  imageUrl?: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}
