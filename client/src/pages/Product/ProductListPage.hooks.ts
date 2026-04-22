import { useState, useMemo, useCallback, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useToast } from '../../contexts/ToastContext';
import { useAuth } from '../../contexts/AuthContext';
import { useCart, useIsMobile, useProducts, useBrands } from '../../hooks';
import { useProductMode } from './useProductMode';
import { Product, Brand } from '../../types';

export const useProductListPage = (mode: 'buy' | 'sell') => {
  const { selectedBrand: selectedBrandParam, clearBrand, selectedBrands, toggleBrand, clearBrands } = useProductMode();
  const { showToast } = useToast();
  const { data: rawBrands = [], isLoading: brandsLoading } = useBrands();
  const brands = Array.isArray(rawBrands) ? rawBrands : [];
  const navigate = useNavigate();
  const isMobile = useIsMobile();

  const { isAuthenticated } = useAuth();
  const { data: rawProducts, isLoading: loading } = useProducts();
  const allProducts = Array.isArray(rawProducts) ? rawProducts : [];
  const [showGiftModal, setShowGiftModal] = useState(false);

  const [quantities, setQuantities] = useState<Record<number, number>>({});

  // Reset quantities when mode or selected brand changes in sell mode (Render-phase adjustment)
  const [prevMeta, setPrevMeta] = useState({ mode, brand: selectedBrandParam });
  if (prevMeta.mode !== mode || prevMeta.brand !== selectedBrandParam) {
    if (mode === 'sell') {
      setQuantities({});
    }
    setPrevMeta({ mode, brand: selectedBrandParam });
  }

  const currentBrand = useMemo(() => {
    if (!selectedBrandParam) return null;
    return brands.find(b => b.code === selectedBrandParam || b.name === selectedBrandParam) || null;
  }, [brands, selectedBrandParam]);

  const { addMultipleToCart, buyNow, checkoutFromCart } = useCart();

  // 구매 모드: 멀티브랜드 필터링
  const buyProducts = useMemo(() => {
    let filtered = allProducts;
    if (selectedBrands.length > 0) {
      const brandSet = new Set(selectedBrands);
      filtered = filtered.filter(p => brandSet.has(p.brandCode));
    }
    return filtered.sort((a, b) => {
      if (a.brandCode !== b.brandCode) return a.brandCode.localeCompare(b.brandCode);
      return Number(a.price) - Number(b.price);
    });
  }, [allProducts, selectedBrands]);

  // 동일 권종(brand+price) 그루핑 → "재고 N개" 표시 + maxNumber 제한
  const groupedProducts = useMemo(() => {
    const groups = new Map<string, { product: Product; stockCount: number }>();
    buyProducts.forEach(p => {
      const key = `${p.brandCode}-${p.price}`;
      const existing = groups.get(key);
      if (existing) {
        existing.stockCount += 1;
      } else {
        groups.set(key, { product: p, stockCount: 1 });
      }
    });
    return Array.from(groups.values());
  }, [buyProducts]);

  const sellProducts = useMemo(() => {
    let filtered = allProducts.filter(p => p.allowTradeIn && p.isActive);
    if (selectedBrandParam) {
      filtered = filtered.filter(p => {
        if (currentBrand) return p.brandCode === currentBrand.code;
        return p.brandCode === selectedBrandParam;
      });
    }
    const seen = new Set<string>();
    filtered = filtered.filter(p => {
      const key = `${p.brandCode}-${p.name}-${p.price}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
    return filtered;
  }, [allProducts, selectedBrandParam, currentBrand]);

  // 브랜드별 가격 범위 (판매 모드 브랜드 선택 그리드용)
  const brandPriceRanges = useMemo(() => {
    const ranges: Record<string, { min: number; max: number }> = {};
    allProducts.forEach(p => {
      const price = Number(p.price);
      if (!ranges[p.brandCode]) {
        ranges[p.brandCode] = { min: price, max: price };
      } else {
        ranges[p.brandCode].min = Math.min(ranges[p.brandCode].min, price);
        ranges[p.brandCode].max = Math.max(ranges[p.brandCode].max, price);
      }
    });
    return ranges;
  }, [allProducts]);

  // 판매 모드용 브랜드 목록 (매입 가능한 상품이 있는 브랜드만)
  const sellBrands = useMemo(() => {
    const counts: Record<string, number> = {};
    const tradeable = allProducts.filter(p => p.allowTradeIn && p.isActive);
    tradeable.forEach(p => {
      counts[p.brandCode] = (counts[p.brandCode] || 0) + 1;
    });
    return {
      brands: brands.filter(b => (counts[b.code] || 0) > 0),
      counts
    };
  }, [allProducts, brands]);

  // 구매 모드용 브랜드 목록 (활성 상품이 있는 브랜드만)
  const buyBrands = useMemo(() => {
    const activeBrandCodes = new Set(allProducts.filter(p => p.isActive).map(p => p.brandCode));
    return brands.filter(b => activeBrandCodes.has(b.code));
  }, [allProducts, brands]);

  // 브랜드별 상품 수 (BrandFilterChips용)
  const productCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    allProducts.filter(p => p.isActive).forEach(p => {
      counts[p.brandCode] = (counts[p.brandCode] || 0) + 1;
    });
    return counts;
  }, [allProducts]);

  // brandMap for ProductCard
  const brandMap = useMemo(() => {
    const map: Record<string, Brand> = {};
    brands.forEach(b => { map[b.code] = b; });
    return map;
  }, [brands]);

  const handleQuantityChange = useCallback((productId: number, quantity: number) => {
    setQuantities(prev => ({ ...prev, [productId]: quantity }));
  }, []);

  const selectedCount = useMemo(() =>
    Object.values(quantities).reduce((sum, qty) => sum + qty, 0),
    [quantities]);

  const totalPrice = useMemo(() =>
    allProducts.reduce((sum, p) => sum + (Number(p.buyPrice) || 0) * (quantities[p.id] || 0), 0),
    [allProducts, quantities]);

  const totalFaceValue = useMemo(() =>
    allProducts.reduce((sum, p) => sum + (Number(p.price) || 0) * (quantities[p.id] || 0), 0),
    [allProducts, quantities]);

  const discountAmount = totalFaceValue - totalPrice;

  const handleAddToCart = useCallback(() => {
    const selected = allProducts.filter(p => (quantities[p.id] || 0) > 0);
    if (selected.length === 0) {
      showToast({ message: '수량을 선택해주세요', type: 'info' });
      return;
    }
    const itemsToAdd = selected.map(product => ({ product, quantity: quantities[product.id] }));
    const result = addMultipleToCart(itemsToAdd);
    if (result.success) {
      setQuantities({});
    }
  }, [allProducts, quantities, addMultipleToCart, showToast]);

  const handleBuyNow = useCallback(() => {
    const selected = allProducts.filter(p => (quantities[p.id] || 0) > 0);
    if (selected.length === 0) {
      showToast({ message: '수량을 선택해주세요', type: 'info' });
      return;
    }
    buyNow(selected.map(product => ({ product, quantity: quantities[product.id] })));
    setQuantities({});
  }, [allProducts, quantities, buyNow, showToast]);

  const handleGiftClick = useCallback(() => {
    if (!isAuthenticated) {
      showToast({ message: '선물하기는 로그인 후 이용할 수 있어요', type: 'info' });
      navigate('/login', { state: { from: '/products' } });
      return;
    }
    const items = allProducts.filter(p => (quantities[p.id] || 0) > 0);
    if (items.length === 0) {
      showToast({ message: '수량을 선택해주세요', type: 'info' });
      return;
    }
    setShowGiftModal(true);
  }, [allProducts, quantities, showToast, isAuthenticated, navigate]);

  const handleGiftConfirm = useCallback((receiver: { email: string; name: string; message: string }) => {
    if (!isAuthenticated) return;
    const selected = allProducts.filter(p => (quantities[p.id] || 0) > 0);
    if (selected.length === 0) return;
    const checkoutItems = selected.map(product => ({ ...product, quantity: quantities[product.id] }));
    checkoutFromCart(checkoutItems, receiver);
    setQuantities({});
  }, [allProducts, quantities, checkoutFromCart, isAuthenticated]);

  // [판매 모드] 브랜드 1개 → 자동 선택
  useEffect(() => {
    if (mode === 'sell' && !selectedBrandParam && sellBrands.brands.length === 1) {
      const brand = sellBrands.brands[0];
      navigate(`/trade-in?brand=${brand.code}`, { replace: true });
    }
  }, [mode, selectedBrandParam, sellBrands.brands, navigate]);

  return {
    selectedBrandParam,
    clearBrand,
    selectedBrands,
    toggleBrand,
    clearBrands,
    brands,
    brandsLoading,
    navigate,
    isMobile,
    isAuthenticated,
    loading,
    allProducts,
    showGiftModal,
    setShowGiftModal,
    quantities,
    currentBrand,
    groupedProducts,
    sellProducts,
    brandPriceRanges,
    sellBrands,
    buyBrands,
    productCounts,
    brandMap,
    selectedCount,
    totalPrice,
    discountAmount,
    handleQuantityChange,
    handleAddToCart,
    handleBuyNow,
    handleGiftClick,
    handleGiftConfirm,
  };
};
