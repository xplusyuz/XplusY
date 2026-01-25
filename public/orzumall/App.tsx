
import React, { useState, useEffect, useMemo } from 'react';
import { HashRouter, Routes, Route, Link, useNavigate } from 'react-router-dom';
import { ShoppingCart, User, Heart, Search, Menu, X, ArrowLeft, Star, Home as HomeIcon } from 'lucide-react';
import { Product, CartItem, Category } from './types';
import { productsData } from './products';

// --- Helper Components ---

const Navbar: React.FC<{
  cartCount: number;
  onSearch: (q: string) => void;
  searchQuery: string;
}> = ({ cartCount, onSearch, searchQuery }) => {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  return (
    <nav className="sticky top-0 z-50 bg-[#cb11ab] text-white shadow-md">
      <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between gap-4">
        {/* Logo */}
        <Link to="/" className="text-2xl font-bold whitespace-nowrap hidden sm:block">
          UzMarket
        </Link>
        
        {/* Mobile Menu Toggle */}
        <button 
          onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
          className="sm:hidden p-2 hover:bg-white/10 rounded-full"
        >
          {isMobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
        </button>

        {/* Search Bar */}
        <div className="flex-1 max-w-2xl relative">
          <input
            type="text"
            placeholder="Mahsulotlarni qidirish..."
            className="w-full h-10 px-4 pr-10 rounded-lg text-gray-800 focus:outline-none focus:ring-2 focus:ring-pink-300"
            value={searchQuery}
            onChange={(e) => onSearch(e.target.value)}
          />
          <Search className="absolute right-3 top-2.5 text-gray-400" size={20} />
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2 sm:gap-6">
          <div className="hidden md:flex flex-col items-center cursor-pointer hover:opacity-80">
            <User size={24} />
            <span className="text-[10px] mt-1">Kirish</span>
          </div>
          <div className="hidden md:flex flex-col items-center cursor-pointer hover:opacity-80">
            <Heart size={24} />
            <span className="text-[10px] mt-1">Saralanganlar</span>
          </div>
          <Link to="/cart" className="flex flex-col items-center relative hover:opacity-80">
            <ShoppingCart size={24} />
            <span className="text-[10px] mt-1">Savat</span>
            {cartCount > 0 && (
              <span className="absolute -top-1 -right-2 bg-yellow-400 text-black text-[10px] font-bold px-1.5 py-0.5 rounded-full min-w-[18px] text-center">
                {cartCount}
              </span>
            )}
          </Link>
        </div>
      </div>

      {/* Mobile Menu Overlay */}
      {isMobileMenuOpen && (
        <div className="absolute top-16 left-0 w-full bg-[#cb11ab] border-t border-white/10 p-4 space-y-4 md:hidden">
          <Link to="/" onClick={() => setIsMobileMenuOpen(false)} className="block py-2">Asosiy</Link>
          <div className="block py-2">Profil</div>
          <div className="block py-2">Saralanganlar</div>
        </div>
      )}
    </nav>
  );
};

const ProductCard: React.FC<{ product: Product; onAddToCart: (p: Product) => void }> = ({ product, onAddToCart }) => {
  const formatPrice = (price: number) => price.toLocaleString('uz-UZ') + " so'm";

  return (
    <div className="bg-white rounded-xl overflow-hidden shadow-sm hover:shadow-lg transition-shadow duration-300 flex flex-col group h-full">
      <Link to={`/product/${product.id}`} className="relative block">
        <img 
          src={product.image} 
          alt={product.name} 
          className="w-full aspect-[3/4] object-cover transition-transform duration-500 group-hover:scale-105"
        />
        {product.discount && (
          <span className="absolute bottom-2 left-2 bg-[#cb11ab] text-white text-xs font-bold px-2 py-1 rounded">
            -{product.discount}%
          </span>
        )}
        {product.isNew && (
          <span className="absolute top-2 left-2 bg-green-500 text-white text-xs font-bold px-2 py-1 rounded">
            Yangi
          </span>
        )}
      </Link>
      
      <div className="p-3 flex flex-col flex-1">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-lg font-bold text-[#cb11ab]">{formatPrice(product.price)}</span>
          {product.oldPrice && (
            <span className="text-sm text-gray-400 line-through">{formatPrice(product.oldPrice)}</span>
          )}
        </div>
        
        <Link to={`/product/${product.id}`} className="text-sm text-gray-700 line-clamp-2 hover:text-[#cb11ab] transition-colors mb-2 min-h-[40px]">
          {product.name}
        </Link>
        
        <div className="flex items-center gap-1 mb-3">
          <Star className="text-yellow-400 fill-yellow-400" size={14} />
          <span className="text-xs font-semibold text-gray-600">{product.rating}</span>
          <span className="text-xs text-gray-400 ml-1">· {product.reviewsCount} baholar</span>
        </div>

        <button 
          onClick={() => onAddToCart(product)}
          className="mt-auto w-full bg-[#cb11ab] hover:bg-[#a80e8d] text-white py-2 rounded-lg text-sm font-semibold transition-colors flex items-center justify-center gap-2"
        >
          <ShoppingCart size={16} />
          Savatga
        </button>
      </div>
    </div>
  );
};

// --- Pages ---

const HomePage: React.FC<{ 
  products: Product[]; 
  onAddToCart: (p: Product) => void;
  selectedCategory: string;
  setSelectedCategory: (c: string) => void;
}> = ({ products, onAddToCart, selectedCategory, setSelectedCategory }) => {
  const categories: Category[] = [
    { id: 'All', name: 'Barchasi', icon: '🛍️' },
    { id: 'Elektronika', name: 'Elektronika', icon: '📱' },
    { id: 'Kiyimlar', name: 'Kiyimlar', icon: '👕' },
    { id: 'Maishiy texnika', name: 'Texnika', icon: '🏠' },
    { id: 'Poyabzallar', name: 'Poyabzallar', icon: '👟' },
    { id: 'Uy-ro\'zg\'or', name: 'Uy-ro\'zg\'or', icon: '🍳' },
    { id: 'Aksessuarlar', name: 'Aksessuarlar', icon: '⌚' }
  ];

  const filteredProducts = selectedCategory === 'All' 
    ? products 
    : products.filter(p => p.category === selectedCategory);

  return (
    <div className="max-w-7xl mx-auto px-4 py-6">
      {/* Banner */}
      <div className="w-full h-48 sm:h-80 bg-gradient-to-r from-purple-700 to-pink-600 rounded-2xl mb-8 flex items-center p-8 text-white">
        <div className="max-w-md">
          <h1 className="text-3xl sm:text-5xl font-bold mb-4">Bahorgi Chegirmalar!</h1>
          <p className="text-lg opacity-90 mb-6">Barcha mahsulotlarga -50% gacha chegirma mavjud.</p>
          <button className="bg-white text-purple-700 px-6 py-2 rounded-full font-bold hover:bg-gray-100 transition-colors">
            Xarid qilish
          </button>
        </div>
      </div>

      {/* Categories Bar */}
      <div className="flex gap-2 overflow-x-auto pb-4 mb-6 no-scrollbar">
        {categories.map(cat => (
          <button
            key={cat.id}
            onClick={() => setSelectedCategory(cat.id)}
            className={`flex items-center gap-2 px-4 py-2 rounded-full border whitespace-nowrap transition-all ${
              selectedCategory === cat.id 
                ? 'bg-[#cb11ab] text-white border-[#cb11ab]' 
                : 'bg-white text-gray-700 border-gray-200 hover:border-[#cb11ab]'
            }`}
          >
            <span>{cat.icon}</span>
            <span className="font-medium">{cat.name}</span>
          </button>
        ))}
      </div>

      {/* Grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
        {filteredProducts.map(product => (
          <ProductCard key={product.id} product={product} onAddToCart={onAddToCart} />
        ))}
      </div>
      
      {filteredProducts.length === 0 && (
        <div className="text-center py-20 bg-white rounded-xl shadow-sm">
          <p className="text-gray-500 text-lg">Bu turkumda mahsulotlar topilmadi.</p>
        </div>
      )}
    </div>
  );
};

const ProductDetailPage: React.FC<{ onAddToCart: (p: Product) => void }> = ({ onAddToCart }) => {
  const navigate = useNavigate();
  const id = window.location.hash.split('/').pop();
  const product = productsData.find(p => p.id === Number(id));

  if (!product) return <div className="p-20 text-center">Mahsulot topilmadi.</div>;

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <button onClick={() => navigate(-1)} className="flex items-center gap-2 text-gray-600 mb-6 hover:text-[#cb11ab]">
        <ArrowLeft size={20} /> Orqaga
      </button>

      <div className="bg-white rounded-2xl shadow-sm p-4 md:p-8 grid md:grid-cols-2 gap-12">
        <div className="rounded-xl overflow-hidden">
          <img src={product.image} alt={product.name} className="w-full object-cover" />
        </div>

        <div className="space-y-6">
          <div className="flex items-center gap-4">
             <span className="bg-gray-100 text-gray-600 px-3 py-1 rounded text-sm">{product.category}</span>
             <div className="flex items-center gap-1 text-yellow-400">
                <Star size={16} fill="currentColor" />
                <span className="text-gray-800 font-bold">{product.rating}</span>
                <span className="text-gray-400 text-sm">({product.reviewsCount} baholar)</span>
             </div>
          </div>

          <h1 className="text-3xl font-bold text-gray-800">{product.name}</h1>
          <p className="text-gray-600 leading-relaxed">{product.description}</p>

          <div className="p-6 bg-gray-50 rounded-xl space-y-4">
            <div className="flex items-baseline gap-4">
              <span className="text-4xl font-bold text-[#cb11ab]">{product.price.toLocaleString()} so'm</span>
              {product.oldPrice && (
                <span className="text-xl text-gray-400 line-through">{product.oldPrice.toLocaleString()} so'm</span>
              )}
            </div>
            <button 
              onClick={() => onAddToCart(product)}
              className="w-full bg-[#cb11ab] hover:bg-[#a80e8d] text-white py-4 rounded-xl text-lg font-bold transition-all transform active:scale-95 shadow-lg shadow-pink-200"
            >
              Savatga qo'shish
            </button>
          </div>

          <div className="grid grid-cols-2 gap-4 text-sm text-gray-500">
            <div className="flex items-center gap-2 border p-3 rounded-lg">
              <span className="text-blue-500">🚚</span> 2-3 kunda yetkazib berish
            </div>
            <div className="flex items-center gap-2 border p-3 rounded-lg">
              <span className="text-green-500">🛡️</span> 1 yil kafolat
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

const CartPage: React.FC<{ 
  cart: CartItem[]; 
  updateQuantity: (id: number, q: number) => void;
  removeFromCart: (id: number) => void;
}> = ({ cart, updateQuantity, removeFromCart }) => {
  const totalPrice = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
  const totalItems = cart.reduce((sum, item) => sum + item.quantity, 0);

  if (cart.length === 0) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-20 text-center">
        <div className="bg-white rounded-2xl p-12 shadow-sm inline-block w-full max-w-lg">
          <ShoppingCart size={80} className="mx-auto text-gray-200 mb-6" />
          <h2 className="text-2xl font-bold text-gray-800 mb-2">Savat bo'sh</h2>
          <p className="text-gray-500 mb-8">Savatda hech narsa yo'q, asosiy sahifaga qaytib tanlang.</p>
          <Link to="/" className="bg-[#cb11ab] text-white px-8 py-3 rounded-xl font-bold hover:bg-[#a80e8d] transition-colors">
            Xarid qilishni boshlash
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold text-gray-800 mb-8">Savat ({totalItems})</h1>
      
      <div className="grid lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-4">
          {cart.map(item => (
            <div key={item.id} className="bg-white rounded-xl p-4 shadow-sm flex gap-4 items-center">
              <img src={item.image} alt={item.name} className="w-24 h-24 object-cover rounded-lg" />
              <div className="flex-1">
                <h3 className="text-gray-800 font-medium line-clamp-1">{item.name}</h3>
                <p className="text-sm text-gray-400 mb-2">{item.category}</p>
                <div className="flex items-center gap-4">
                  <div className="flex items-center border rounded-lg overflow-hidden">
                    <button 
                      onClick={() => updateQuantity(item.id, item.quantity - 1)}
                      className="px-3 py-1 bg-gray-50 hover:bg-gray-100 text-gray-600 disabled:opacity-30"
                      disabled={item.quantity <= 1}
                    >
                      -
                    </button>
                    <span className="px-4 py-1 font-medium">{item.quantity}</span>
                    <button 
                      onClick={() => updateQuantity(item.id, item.quantity + 1)}
                      className="px-3 py-1 bg-gray-50 hover:bg-gray-100 text-gray-600"
                    >
                      +
                    </button>
                  </div>
                  <button 
                    onClick={() => removeFromCart(item.id)}
                    className="text-red-500 text-sm hover:underline"
                  >
                    O'chirish
                  </button>
                </div>
              </div>
              <div className="text-right">
                <p className="text-lg font-bold text-[#cb11ab]">{(item.price * item.quantity).toLocaleString()} so'm</p>
                {item.quantity > 1 && (
                  <p className="text-xs text-gray-400">{item.price.toLocaleString()} so'm / dona</p>
                )}
              </div>
            </div>
          ))}
        </div>

        <div className="lg:col-span-1">
          <div className="bg-white rounded-2xl p-6 shadow-sm sticky top-24">
            <h3 className="text-xl font-bold mb-6">Buyurtma xulosasi</h3>
            <div className="space-y-3 mb-6">
              <div className="flex justify-between text-gray-600">
                <span>Mahsulotlar ({totalItems}):</span>
                <span>{totalPrice.toLocaleString()} so'm</span>
              </div>
              <div className="flex justify-between text-gray-600">
                <span>Yetkazib berish:</span>
                <span className="text-green-500 font-medium">Bepul</span>
              </div>
              <div className="border-t pt-3 flex justify-between text-xl font-bold text-gray-800">
                <span>Jami:</span>
                <span>{totalPrice.toLocaleString()} so'm</span>
              </div>
            </div>
            <button className="w-full bg-[#cb11ab] hover:bg-[#a80e8d] text-white py-4 rounded-xl font-bold text-lg transition-all shadow-lg shadow-pink-100">
              Rasmiylashtirish
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

// --- Main App ---

const App: React.FC = () => {
  const [cart, setCart] = useState<CartItem[]>(() => {
    const saved = localStorage.getItem('cart');
    return saved ? JSON.parse(saved) : [];
  });
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');

  useEffect(() => {
    localStorage.setItem('cart', JSON.stringify(cart));
  }, [cart]);

  const addToCart = (product: Product) => {
    setCart(prev => {
      const existing = prev.find(item => item.id === product.id);
      if (existing) {
        return prev.map(item => 
          item.id === product.id ? { ...item, quantity: item.quantity + 1 } : item
        );
      }
      return [...prev, { ...product, quantity: 1 }];
    });
  };

  const updateQuantity = (id: number, quantity: number) => {
    setCart(prev => prev.map(item => item.id === id ? { ...item, quantity } : item));
  };

  const removeFromCart = (id: number) => {
    setCart(prev => prev.filter(item => item.id !== id));
  };

  const filteredProducts = useMemo(() => {
    return productsData.filter(p => 
      p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.category.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [searchQuery]);

  const cartCount = cart.reduce((sum, item) => sum + item.quantity, 0);

  return (
    <HashRouter>
      <div className="min-h-screen flex flex-col">
        <Navbar cartCount={cartCount} onSearch={setSearchQuery} searchQuery={searchQuery} />
        
        <main className="flex-1 bg-gray-50 pb-20">
          <Routes>
            <Route 
              path="/" 
              element={
                <HomePage 
                  products={filteredProducts} 
                  onAddToCart={addToCart} 
                  selectedCategory={selectedCategory}
                  setSelectedCategory={setSelectedCategory}
                />
              } 
            />
            <Route 
              path="/product/:id" 
              element={<ProductDetailPage onAddToCart={addToCart} />} 
            />
            <Route 
              path="/cart" 
              element={
                <CartPage 
                  cart={cart} 
                  updateQuantity={updateQuantity} 
                  removeFromCart={removeFromCart} 
                />
              } 
            />
          </Routes>
        </main>

        <footer className="bg-white border-t py-12">
          <div className="max-w-7xl mx-auto px-4 grid grid-cols-2 md:grid-cols-4 gap-8">
            <div>
              <h4 className="font-bold text-gray-800 mb-4">Kompaniya</h4>
              <ul className="space-y-2 text-sm text-gray-500">
                <li><a href="#" className="hover:text-[#cb11ab]">Biz haqimizda</a></li>
                <li><a href="#" className="hover:text-[#cb11ab]">Ish o'rinlari</a></li>
                <li><a href="#" className="hover:text-[#cb11ab]">Blog</a></li>
              </ul>
            </div>
            <div>
              <h4 className="font-bold text-gray-800 mb-4">Mijozlar uchun</h4>
              <ul className="space-y-2 text-sm text-gray-500">
                <li><a href="#" className="hover:text-[#cb11ab]">Qo'llab-quvvatlash</a></li>
                <li><a href="#" className="hover:text-[#cb11ab]">Yetkazib berish</a></li>
                <li><a href="#" className="hover:text-[#cb11ab]">Qaytarish siyosati</a></li>
              </ul>
            </div>
            <div>
              <h4 className="font-bold text-gray-800 mb-4">Hamkorlik</h4>
              <ul className="space-y-2 text-sm text-gray-500">
                <li><a href="#" className="hover:text-[#cb11ab]">Marketpleysda sotish</a></li>
                <li><a href="#" className="hover:text-[#cb11ab]">Hamkorlar dasturi</a></li>
              </ul>
            </div>
            <div>
              <h4 className="font-bold text-gray-800 mb-4">Ilovani yuklab oling</h4>
              <div className="space-y-2">
                <div className="h-10 w-32 bg-gray-800 rounded-lg flex items-center justify-center text-white text-xs font-bold">App Store</div>
                <div className="h-10 w-32 bg-gray-800 rounded-lg flex items-center justify-center text-white text-xs font-bold">Google Play</div>
              </div>
            </div>
          </div>
          <div className="max-w-7xl mx-auto px-4 mt-12 pt-8 border-t text-center text-gray-400 text-sm">
            © 2024 UzMarket Pro. Barcha huquqlar himoyalangan.
          </div>
        </footer>

        {/* Bottom Navigation for Mobile */}
        <div className="md:hidden fixed bottom-0 left-0 w-full bg-white border-t flex justify-around py-3 z-50">
          <Link to="/" className="flex flex-col items-center text-gray-500">
            <HomeIcon size={22} className={window.location.hash === '#/' ? 'text-[#cb11ab]' : ''} />
            <span className="text-[10px] mt-1">Asosiy</span>
          </Link>
          <div className="flex flex-col items-center text-gray-500">
            <Search size={22} />
            <span className="text-[10px] mt-1">Qidiruv</span>
          </div>
          <Link to="/cart" className="flex flex-col items-center text-gray-500 relative">
            <ShoppingCart size={22} className={window.location.hash === '#/cart' ? 'text-[#cb11ab]' : ''} />
            <span className="text-[10px] mt-1">Savat</span>
            {cartCount > 0 && (
              <span className="absolute -top-1 -right-1 bg-[#cb11ab] text-white text-[8px] rounded-full w-4 h-4 flex items-center justify-center">
                {cartCount}
              </span>
            )}
          </Link>
          <div className="flex flex-col items-center text-gray-500">
            <User size={22} />
            <span className="text-[10px] mt-1">Profil</span>
          </div>
        </div>
      </div>
    </HashRouter>
  );
};

export default App;
