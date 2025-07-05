'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/Button';
import { formatPrice } from '@/lib/utils';

interface OrderItem {
  id: string;
  product: {
    id: string;
    name: string;
    price: number;
    imageUrl: string;
    platform: string;
  };
  quantity: number;
  subtotal: number;
}

interface ShippingAddress {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  address: string;
  city: string;
  state: string;
  zipCode: string;
  country: string;
}

interface Order {
  id: string;
  userId: string;
  items: OrderItem[];
  subtotal: number;
  shipping: number;
  tax: number;
  total: number;
  status: 'pending' | 'processing' | 'shipped' | 'delivered' | 'cancelled' | 'refunded';
  paymentStatus: 'pending' | 'paid' | 'failed' | 'refunded';
  paymentMethod: string;
  shippingAddress: ShippingAddress;
  trackingNumber?: string;
  trackingUrl?: string;
  carrier?: string;
  estimatedDelivery?: string;
  createdAt: string;
  updatedAt: string;
}

export default function OrdersPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<'date' | 'status' | 'total'>('date');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  
  const router = useRouter();

  useEffect(() => {
    loadOrders();
  }, []);

  const loadOrders = async () => {
    try {
      setIsLoading(true);
      
      // Load orders from localStorage for now
      const savedOrders = localStorage.getItem('orders');
      if (savedOrders) {
        const parsedOrders = JSON.parse(savedOrders);
        setOrders(parsedOrders);
      } else {
        // Create sample orders for demonstration
        const sampleOrders: Order[] = [
          {
            id: 'order-1',
            userId: 'user-1',
            items: [
              {
                id: 'item-1',
                product: {
                  id: 'product-1',
                  name: 'Nike Air Max 270',
                  price: 150.00,
                  imageUrl: 'https://via.placeholder.com/150',
                  platform: 'Nike',
                },
                quantity: 1,
                subtotal: 150.00,
              },
            ],
            subtotal: 150.00,
            shipping: 5.99,
            tax: 12.00,
            total: 167.99,
            status: 'delivered',
            paymentStatus: 'paid',
            paymentMethod: 'Credit Card',
            shippingAddress: {
              firstName: 'John',
              lastName: 'Doe',
              email: 'john@example.com',
              phone: '+1234567890',
              address: '123 Main St',
              city: 'New York',
              state: 'NY',
              zipCode: '10001',
              country: 'United States',
            },
            trackingNumber: '1Z999AA1234567890',
            trackingUrl: 'https://www.ups.com/track',
            carrier: 'UPS',
            estimatedDelivery: '2024-01-15',
            createdAt: '2024-01-10T10:00:00Z',
            updatedAt: '2024-01-15T14:30:00Z',
          },
          {
            id: 'order-2',
            userId: 'user-1',
            items: [
              {
                id: 'item-2',
                product: {
                  id: 'product-2',
                  name: 'Adidas Ultraboost 22',
                  price: 180.00,
                  imageUrl: 'https://via.placeholder.com/150',
                  platform: 'Adidas',
                },
                quantity: 1,
                subtotal: 180.00,
              },
            ],
            subtotal: 180.00,
            shipping: 5.99,
            tax: 14.40,
            total: 200.39,
            status: 'shipped',
            paymentStatus: 'paid',
            paymentMethod: 'PayPal',
            shippingAddress: {
              firstName: 'John',
              lastName: 'Doe',
              email: 'john@example.com',
              phone: '+1234567890',
              address: '123 Main St',
              city: 'New York',
              state: 'NY',
              zipCode: '10001',
              country: 'United States',
            },
            trackingNumber: '9400100000000000000000',
            trackingUrl: 'https://tools.usps.com/go/TrackConfirmAction',
            carrier: 'USPS',
            estimatedDelivery: '2024-01-20',
            createdAt: '2024-01-12T15:30:00Z',
            updatedAt: '2024-01-18T09:15:00Z',
          },
        ];
        setOrders(sampleOrders);
        localStorage.setItem('orders', JSON.stringify(sampleOrders));
      }
    } catch (error) {
      console.error('Failed to load orders:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const getFilteredAndSortedOrders = () => {
    let filtered = orders;

    // Apply status filter
    if (filterStatus !== 'all') {
      filtered = filtered.filter(order => order.status === filterStatus);
    }

    // Apply search filter
    if (searchQuery) {
      filtered = filtered.filter(order =>
        order.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
        order.items.some(item => 
          item.product.name.toLowerCase().includes(searchQuery.toLowerCase())
        )
      );
    }

    // Apply sorting
    filtered.sort((a, b) => {
      let comparison = 0;
      
      switch (sortBy) {
        case 'date':
          comparison = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
          break;
        case 'status':
          comparison = a.status.localeCompare(b.status);
          break;
        case 'total':
          comparison = a.total - b.total;
          break;
      }
      
      return sortOrder === 'asc' ? comparison : -comparison;
    });

    return filtered;
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending':
        return 'bg-yellow-100 text-yellow-800';
      case 'processing':
        return 'bg-blue-100 text-blue-800';
      case 'shipped':
        return 'bg-purple-100 text-purple-800';
      case 'delivered':
        return 'bg-green-100 text-green-800';
      case 'cancelled':
        return 'bg-red-100 text-red-800';
      case 'refunded':
        return 'bg-gray-100 text-gray-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'pending':
        return '⏳';
      case 'processing':
        return '🔄';
      case 'shipped':
        return '📦';
      case 'delivered':
        return '✅';
      case 'cancelled':
        return '❌';
      case 'refunded':
        return '💰';
      default:
        return '📋';
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const reorderItems = async (orderId: string) => {
    try {
      const order = orders.find(o => o.id === orderId);
      if (!order) return;

      // Add items to cart
      const cartData = localStorage.getItem('cart');
      const cartItems = cartData ? JSON.parse(cartData) : [];
      
      order.items.forEach(item => {
        const cartItem = {
          id: `cart-${Date.now()}-${item.id}`,
          product: item.product,
          quantity: item.quantity,
        };
        cartItems.push(cartItem);
      });
      
      localStorage.setItem('cart', JSON.stringify(cartItems));
      
      // Navigate to cart
      router.push('/cart');
    } catch (error) {
      console.error('Failed to reorder items:', error);
    }
  };

  const cancelOrder = async (orderId: string) => {
    if (!confirm('Are you sure you want to cancel this order?')) return;

    try {
      const updatedOrders = orders.map(order => {
        if (order.id === orderId && order.status === 'pending') {
          return {
            ...order,
            status: 'cancelled',
            updatedAt: new Date().toISOString(),
          };
        }
        return order;
      });

      setOrders(updatedOrders);
      localStorage.setItem('orders', JSON.stringify(updatedOrders));
    } catch (error) {
      console.error('Failed to cancel order:', error);
    }
  };

  const requestRefund = async (orderId: string) => {
    if (!confirm('Are you sure you want to request a refund for this order?')) return;

    try {
      const updatedOrders = orders.map(order => {
        if (order.id === orderId) {
          return {
            ...order,
            status: 'refunded',
            paymentStatus: 'refunded',
            updatedAt: new Date().toISOString(),
          };
        }
        return order;
      });

      setOrders(updatedOrders);
      localStorage.setItem('orders', JSON.stringify(updatedOrders));
    } catch (error) {
      console.error('Failed to request refund:', error);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading orders...</p>
        </div>
      </div>
    );
  }

  const filteredOrders = getFilteredAndSortedOrders();

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">My Orders</h1>
          <p className="mt-2 text-gray-600">
            Track your orders and view order history
          </p>
        </div>

        {/* Filters and Search */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="all">All Orders</option>
                <option value="pending">Pending</option>
                <option value="processing">Processing</option>
                <option value="shipped">Shipped</option>
                <option value="delivered">Delivered</option>
                <option value="cancelled">Cancelled</option>
                <option value="refunded">Refunded</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Sort By</label>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as 'date' | 'status' | 'total')}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="date">Date</option>
                <option value="status">Status</option>
                <option value="total">Total</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Order</label>
              <select
                value={sortOrder}
                onChange={(e) => setSortOrder(e.target.value as 'asc' | 'desc')}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="desc">Newest First</option>
                <option value="asc">Oldest First</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Search</label>
              <input
                type="text"
                placeholder="Search orders..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
        </div>

        {/* Orders List */}
        <div className="space-y-6">
          {filteredOrders.length === 0 ? (
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-12 text-center">
              <div className="w-24 h-24 mx-auto mb-4 bg-gray-100 rounded-full flex items-center justify-center">
                <svg className="w-12 h-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
                </svg>
              </div>
              <h3 className="text-lg font-medium text-gray-900 mb-2">No orders found</h3>
              <p className="text-gray-600 mb-4">
                {searchQuery || filterStatus !== 'all' 
                  ? 'Try adjusting your search or filters'
                  : 'Start shopping to see your orders here'
                }
              </p>
              <Button onClick={() => router.push('/products')}>
                Browse Products
              </Button>
            </div>
          ) : (
            filteredOrders.map((order) => (
              <div key={order.id} className="bg-white rounded-lg shadow-sm border border-gray-200">
                {/* Order Header */}
                <div className="p-6 border-b border-gray-200">
                  <div className="flex justify-between items-start">
                    <div>
                      <h3 className="text-lg font-semibold text-gray-900">
                        Order #{order.id}
                      </h3>
                      <p className="text-sm text-gray-500">
                        Placed on {formatDate(order.createdAt)}
                      </p>
                      {order.estimatedDelivery && (
                        <p className="text-sm text-gray-500">
                          Estimated delivery: {formatDate(order.estimatedDelivery)}
                        </p>
                      )}
                    </div>
                    <div className="text-right">
                      <div className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${getStatusColor(order.status)}`}>
                        <span className="mr-1">{getStatusIcon(order.status)}</span>
                        {order.status.charAt(0).toUpperCase() + order.status.slice(1)}
                      </div>
                      <p className="text-lg font-semibold text-gray-900 mt-1">
                        {formatPrice(order.total)}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Order Items */}
                <div className="p-6">
                  <div className="space-y-4">
                    {order.items.map((item) => (
                      <div key={item.id} className="flex items-center space-x-4">
                        <img
                          src={item.product.imageUrl}
                          alt={item.product.name}
                          className="w-16 h-16 object-cover rounded-lg"
                        />
                        <div className="flex-1">
                          <h4 className="font-medium text-gray-900">{item.product.name}</h4>
                          <p className="text-sm text-gray-500">{item.product.platform}</p>
                          <p className="text-sm text-gray-500">Qty: {item.quantity}</p>
                        </div>
                        <div className="text-right">
                          <p className="font-medium text-gray-900">{formatPrice(item.subtotal)}</p>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Order Actions */}
                  <div className="mt-6 pt-6 border-t border-gray-200">
                    <div className="flex flex-wrap gap-3">
                      <Button
                        onClick={() => setSelectedOrder(selectedOrder?.id === order.id ? null : order)}
                        variant="outline"
                        size="sm"
                      >
                        {selectedOrder?.id === order.id ? 'Hide Details' : 'View Details'}
                      </Button>
                      
                      {order.status === 'delivered' && (
                        <Button
                          onClick={() => reorderItems(order.id)}
                          size="sm"
                        >
                          Reorder
                        </Button>
                      )}
                      
                      {order.status === 'pending' && (
                        <Button
                          onClick={() => cancelOrder(order.id)}
                          variant="outline"
                          size="sm"
                          className="text-red-600 hover:text-red-700"
                        >
                          Cancel Order
                        </Button>
                      )}
                      
                      {(order.status === 'delivered' || order.status === 'shipped') && (
                        <Button
                          onClick={() => requestRefund(order.id)}
                          variant="outline"
                          size="sm"
                          className="text-orange-600 hover:text-orange-700"
                        >
                          Request Refund
                        </Button>
                      )}
                      
                      {order.trackingUrl && (
                        <a
                          href={order.trackingUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center px-3 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
                        >
                          Track Package
                        </a>
                      )}
                    </div>
                  </div>

                  {/* Order Details */}
                  {selectedOrder?.id === order.id && (
                    <div className="mt-6 pt-6 border-t border-gray-200">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {/* Shipping Information */}
                        <div>
                          <h4 className="font-medium text-gray-900 mb-3">Shipping Information</h4>
                          <div className="bg-gray-50 rounded-lg p-4">
                            <p className="text-sm text-gray-900">
                              {order.shippingAddress.firstName} {order.shippingAddress.lastName}
                            </p>
                            <p className="text-sm text-gray-600">{order.shippingAddress.address}</p>
                            <p className="text-sm text-gray-600">
                              {order.shippingAddress.city}, {order.shippingAddress.state} {order.shippingAddress.zipCode}
                            </p>
                            <p className="text-sm text-gray-600">{order.shippingAddress.country}</p>
                            <p className="text-sm text-gray-600">{order.shippingAddress.phone}</p>
                            <p className="text-sm text-gray-600">{order.shippingAddress.email}</p>
                          </div>
                          {order.trackingNumber && (
                            <div className="mt-3">
                              <p className="text-sm text-gray-600">
                                <strong>Tracking:</strong> {order.trackingNumber}
                              </p>
                              {order.carrier && (
                                <p className="text-sm text-gray-600">
                                  <strong>Carrier:</strong> {order.carrier}
                                </p>
                              )}
                            </div>
                          )}
                        </div>

                        {/* Payment Information */}
                        <div>
                          <h4 className="font-medium text-gray-900 mb-3">Payment Information</h4>
                          <div className="bg-gray-50 rounded-lg p-4">
                            <div className="flex justify-between text-sm mb-2">
                              <span>Subtotal:</span>
                              <span>{formatPrice(order.subtotal)}</span>
                            </div>
                            <div className="flex justify-between text-sm mb-2">
                              <span>Shipping:</span>
                              <span>{formatPrice(order.shipping)}</span>
                            </div>
                            <div className="flex justify-between text-sm mb-2">
                              <span>Tax:</span>
                              <span>{formatPrice(order.tax)}</span>
                            </div>
                            <div className="flex justify-between font-medium pt-2 border-t border-gray-200">
                              <span>Total:</span>
                              <span>{formatPrice(order.total)}</span>
                            </div>
                            <div className="mt-3 pt-3 border-t border-gray-200">
                              <p className="text-sm text-gray-600">
                                <strong>Payment Method:</strong> {order.paymentMethod}
                              </p>
                              <p className="text-sm text-gray-600">
                                <strong>Payment Status:</strong> {order.paymentStatus}
                              </p>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
} 