
export interface Product {
  id: number;
  name: string;
  price: number;
  oldPrice?: number;
  category: string;
  rating: number;
  reviewsCount: number;
  image: string;
  description: string;
  discount?: number;
  isNew?: boolean;
}

export interface CartItem extends Product {
  quantity: number;
}

export interface Category {
  id: string;
  name: string;
  icon: string;
}
