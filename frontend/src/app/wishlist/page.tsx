'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/Button';
import { formatPrice } from '@/lib/utils';

interface WishlistItem {
  id: string;
  product: {
    id: string;
    name: string;
    price: number;
    originalPrice?: number;
    imageUrl: string;
    description: string;
    platform: string;
    url: string;
    category: string;
    brand: string;
  };
  addedAt: string;
  notes?: string;
  priceAlerts: boolean;
  targetPrice?: number;
}

interface Wishlist {
  id: string;
  name: string;
  description?: string;
  isPublic: boolean;
  items: WishlistItem[];
  createdAt: string;
  updatedAt: string;
}

export default function WishlistPage() {
  const [wishlists, setWishlists] = useState<Wishlist[]>([]);
  const [activeWishlist, setActiveWishlist] = useState<Wishlist | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newWishlistName, setNewWishlistName] = useState('');
  const [newWishlistDescription, setNewWishlistDescription] = useState('');
  const [isPublic, setIsPublic] = useState(false);
  const [editingItem, setEditingItem] = useState<string | null>(null);
  const [itemNotes, setItemNotes] = useState('');
  const [itemTargetPrice, setItemTargetPrice] = useState('');
  const [itemPriceAlerts, setItemPriceAlerts] = useState(false);
  
  const router = useRouter();

  useEffect(() => {
    loadWishlists();
  }, []);

  const loadWishlists = async () => {
    try {
      setIsLoading(true);
      
      // Load wishlists from localStorage for now
      const savedWishlists = localStorage.getItem('wishlists');
      if (savedWishlists) {
        const parsedWishlists = JSON.parse(savedWishlists);
        setWishlists(parsedWishlists);
        
        if (parsedWishlists.length > 0) {
          setActiveWishlist(parsedWishlists[0]);
        }
      } else {
        // Create default wishlist
        const defaultWishlist: Wishlist = {
          id: 'default',
          name: 'My Wishlist',
          description: 'Default wishlist',
          isPublic: false,
          items: [],
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
        setWishlists([defaultWishlist]);
        setActiveWishlist(defaultWishlist);
      }
    } catch (error) {
      console.error('Failed to load wishlists:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const createWishlist = async () => {
    if (!newWishlistName.trim()) return;

    try {
      setIsCreating(true);
      
      const newWishlist: Wishlist = {
        id: `wishlist-${Date.now()}`,
        name: newWishlistName,
        description: newWishlistDescription,
        isPublic,
        items: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      const updatedWishlists = [...wishlists, newWishlist];
      setWishlists(updatedWishlists);
      setActiveWishlist(newWishlist);
      
      // Save to localStorage
      localStorage.setItem('wishlists', JSON.stringify(updatedWishlists));
      
      // Reset form
      setNewWishlistName('');
      setNewWishlistDescription('');
      setIsPublic(false);
      setShowCreateForm(false);
      
    } catch (error) {
      console.error('Failed to create wishlist:', error);
    } finally {
      setIsCreating(false);
    }
  };

  const deleteWishlist = async (wishlistId: string) => {
    if (!confirm('Are you sure you want to delete this wishlist?')) return;

    try {
      const updatedWishlists = wishlists.filter(w => w.id !== wishlistId);
      setWishlists(updatedWishlists);
      
      if (activeWishlist?.id === wishlistId) {
        setActiveWishlist(updatedWishlists.length > 0 ? updatedWishlists[0] : null);
      }
      
      localStorage.setItem('wishlists', JSON.stringify(updatedWishlists));
    } catch (error) {
      console.error('Failed to delete wishlist:', error);
    }
  };

  const addToWishlist = async (product: any, wishlistId: string = activeWishlist?.id || 'default') => {
    try {
      const wishlistItem: WishlistItem = {
        id: `item-${Date.now()}`,
        product: {
          id: product.id,
          name: product.name,
          price: product.price,
          originalPrice: product.originalPrice,
          imageUrl: product.imageUrl,
          description: product.description,
          platform: product.platform,
          url: product.url,
          category: product.category,
          brand: product.brand,
        },
        addedAt: new Date().toISOString(),
        priceAlerts: false,
      };

      const updatedWishlists = wishlists.map(w => {
        if (w.id === wishlistId) {
          return {
            ...w,
            items: [...w.items, wishlistItem],
            updatedAt: new Date().toISOString(),
          };
        }
        return w;
      });

      setWishlists(updatedWishlists);
      setActiveWishlist(updatedWishlists.find(w => w.id === wishlistId) || null);
      localStorage.setItem('wishlists', JSON.stringify(updatedWishlists));
      
    } catch (error) {
      console.error('Failed to add to wishlist:', error);
    }
  };

  const removeFromWishlist = async (itemId: string) => {
    try {
      const updatedWishlists = wishlists.map(w => {
        if (w.id === activeWishlist?.id) {
          return {
            ...w,
            items: w.items.filter(item => item.id !== itemId),
            updatedAt: new Date().toISOString(),
          };
        }
        return w;
      });

      setWishlists(updatedWishlists);
      setActiveWishlist(updatedWishlists.find(w => w.id === activeWishlist?.id) || null);
      localStorage.setItem('wishlists', JSON.stringify(updatedWishlists));
    } catch (error) {
      console.error('Failed to remove from wishlist:', error);
    }
  };

  const updateWishlistItem = async (itemId: string, updates: Partial<WishlistItem>) => {
    try {
      const updatedWishlists = wishlists.map(w => {
        if (w.id === activeWishlist?.id) {
          return {
            ...w,
            items: w.items.map(item => 
              item.id === itemId ? { ...item, ...updates } : item
            ),
            updatedAt: new Date().toISOString(),
          };
        }
        return w;
      });

      setWishlists(updatedWishlists);
      setActiveWishlist(updatedWishlists.find(w => w.id === activeWishlist?.id) || null);
      localStorage.setItem('wishlists', JSON.stringify(updatedWishlists));
      setEditingItem(null);
    } catch (error) {
      console.error('Failed to update wishlist item:', error);
    }
  };

  const moveToCart = async (item: WishlistItem) => {
    try {
      // Add to cart
      const cartData = localStorage.getItem('cart');
      const cartItems = cartData ? JSON.parse(cartData) : [];
      
      const cartItem = {
        id: `cart-${Date.now()}`,
        product: item.product,
        quantity: 1,
      };
      
      cartItems.push(cartItem);
      localStorage.setItem('cart', JSON.stringify(cartItems));
      
      // Remove from wishlist
      await removeFromWishlist(item.id);
      
      // Navigate to cart
      router.push('/cart');
    } catch (error) {
      console.error('Failed to move to cart:', error);
    }
  };

  const shareWishlist = async (wishlist: Wishlist) => {
    try {
      const shareUrl = `${window.location.origin}/wishlist/${wishlist.id}`;
      
      if (navigator.share) {
        await navigator.share({
          title: wishlist.name,
          text: wishlist.description || 'Check out my wishlist!',
          url: shareUrl,
        });
      } else {
        await navigator.clipboard.writeText(shareUrl);
        alert('Wishlist URL copied to clipboard!');
      }
    } catch (error) {
      console.error('Failed to share wishlist:', error);
    }
  };

  const getTotalValue = (items: WishlistItem[]) => {
    return items.reduce((total, item) => total + item.product.price, 0);
  };

  const getSavings = (items: WishlistItem[]) => {
    return items.reduce((total, item) => {
      if (item.product.originalPrice) {
        return total + (item.product.originalPrice - item.product.price);
      }
      return total;
    }, 0);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading wishlists...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">My Wishlists</h1>
          <p className="mt-2 text-gray-600">
            Save products you love and track price changes
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
          {/* Sidebar - Wishlist Navigation */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-lg font-semibold text-gray-900">Wishlists</h2>
                <Button
                  onClick={() => setShowCreateForm(true)}
                  size="sm"
                  variant="outline"
                >
                  New
                </Button>
              </div>

              {/* Create Wishlist Form */}
              {showCreateForm && (
                <div className="mb-4 p-4 bg-gray-50 rounded-lg">
                  <input
                    type="text"
                    placeholder="Wishlist name"
                    value={newWishlistName}
                    onChange={(e) => setNewWishlistName(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg mb-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <textarea
                    placeholder="Description (optional)"
                    value={newWishlistDescription}
                    onChange={(e) => setNewWishlistDescription(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg mb-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    rows={2}
                  />
                  <div className="flex items-center mb-2">
                    <input
                      type="checkbox"
                      id="isPublic"
                      checked={isPublic}
                      onChange={(e) => setIsPublic(e.target.checked)}
                      className="mr-2"
                    />
                    <label htmlFor="isPublic" className="text-sm text-gray-700">
                      Make public
                    </label>
                  </div>
                  <div className="flex space-x-2">
                    <Button
                      onClick={createWishlist}
                      disabled={isCreating || !newWishlistName.trim()}
                      size="sm"
                    >
                      {isCreating ? 'Creating...' : 'Create'}
                    </Button>
                    <Button
                      onClick={() => setShowCreateForm(false)}
                      variant="outline"
                      size="sm"
                    >
                      Cancel
                    </Button>
                  </div>
                </div>
              )}

              {/* Wishlist List */}
              <div className="space-y-2">
                {wishlists.map((wishlist) => (
                  <div
                    key={wishlist.id}
                    className={`p-3 rounded-lg cursor-pointer transition-colors ${
                      activeWishlist?.id === wishlist.id
                        ? 'bg-blue-50 border border-blue-200'
                        : 'hover:bg-gray-50'
                    }`}
                    onClick={() => setActiveWishlist(wishlist)}
                  >
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <h3 className="font-medium text-gray-900 truncate">
                          {wishlist.name}
                        </h3>
                        <p className="text-sm text-gray-500">
                          {wishlist.items.length} items
                        </p>
                      </div>
                      {wishlists.length > 1 && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            deleteWishlist(wishlist.id);
                          }}
                          className="text-red-500 hover:text-red-700 text-sm"
                        >
                          ×
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Main Content - Wishlist Items */}
          <div className="lg:col-span-3">
            {activeWishlist ? (
              <div className="bg-white rounded-lg shadow-sm border border-gray-200">
                {/* Wishlist Header */}
                <div className="p-6 border-b border-gray-200">
                  <div className="flex justify-between items-start">
                    <div>
                      <h2 className="text-xl font-semibold text-gray-900">
                        {activeWishlist.name}
                      </h2>
                      {activeWishlist.description && (
                        <p className="text-gray-600 mt-1">{activeWishlist.description}</p>
                      )}
                      <div className="flex items-center space-x-4 mt-2 text-sm text-gray-500">
                        <span>{activeWishlist.items.length} items</span>
                        <span>Total: {formatPrice(getTotalValue(activeWishlist.items))}</span>
                        {getSavings(activeWishlist.items) > 0 && (
                          <span className="text-green-600">
                            Save: {formatPrice(getSavings(activeWishlist.items))}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex space-x-2">
                      <Button
                        onClick={() => shareWishlist(activeWishlist)}
                        variant="outline"
                        size="sm"
                      >
                        Share
                      </Button>
                      {activeWishlist.isPublic && (
                        <span className="px-2 py-1 bg-green-100 text-green-800 text-xs rounded-full">
                          Public
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Wishlist Items */}
                <div className="p-6">
                  {activeWishlist.items.length === 0 ? (
                    <div className="text-center py-12">
                      <div className="w-24 h-24 mx-auto mb-4 bg-gray-100 rounded-full flex items-center justify-center">
                        <svg className="w-12 h-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                        </svg>
                      </div>
                      <h3 className="text-lg font-medium text-gray-900 mb-2">Your wishlist is empty</h3>
                      <p className="text-gray-600 mb-4">Start adding products you love!</p>
                      <Button onClick={() => router.push('/products')}>
                        Browse Products
                      </Button>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {activeWishlist.items.map((item) => (
                        <div key={item.id} className="flex items-center space-x-4 p-4 border border-gray-200 rounded-lg">
                          <img
                            src={item.product.imageUrl}
                            alt={item.product.name}
                            className="w-20 h-20 object-cover rounded-lg"
                          />
                          <div className="flex-1 min-w-0">
                            <h3 className="text-lg font-medium text-gray-900 truncate">
                              {item.product.name}
                            </h3>
                            <p className="text-sm text-gray-500 truncate">
                              {item.product.brand} • {item.product.platform}
                            </p>
                            <div className="flex items-center space-x-2 mt-1">
                              <span className="text-lg font-semibold text-gray-900">
                                {formatPrice(item.product.price)}
                              </span>
                              {item.product.originalPrice && item.product.originalPrice > item.product.price && (
                                <span className="text-sm text-gray-500 line-through">
                                  {formatPrice(item.product.originalPrice)}
                                </span>
                              )}
                            </div>
                            {item.notes && (
                              <p className="text-sm text-gray-600 mt-1">{item.notes}</p>
                            )}
                          </div>
                          <div className="flex flex-col space-y-2">
                            <Button
                              onClick={() => moveToCart(item)}
                              size="sm"
                            >
                              Add to Cart
                            </Button>
                            <Button
                              onClick={() => setEditingItem(editingItem === item.id ? null : item.id)}
                              variant="outline"
                              size="sm"
                            >
                              {editingItem === item.id ? 'Cancel' : 'Edit'}
                            </Button>
                            <Button
                              onClick={() => removeFromWishlist(item.id)}
                              variant="outline"
                              size="sm"
                              className="text-red-600 hover:text-red-700"
                            >
                              Remove
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-12 text-center">
                <h3 className="text-lg font-medium text-gray-900 mb-2">No wishlist selected</h3>
                <p className="text-gray-600">Select a wishlist from the sidebar or create a new one.</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
} 