'use client';

import React from 'react';
import Image from 'next/image';
import { Button } from './ui/Button';
import { formatPrice, truncateText } from '@/lib/utils';

interface ProductCardProps {
  product: {
    id: string;
    name: string;
    description: string;
    price: number;
    originalPrice?: number;
    currency: string;
    imageUrl: string;
    platform: string;
    rating?: number;
    reviewCount?: number;
    inStock: boolean;
    discount?: number;
  };
  onAddToCart?: (productId: string) => void;
  onViewDetails?: (productId: string) => void;
  onTryOn?: (productId: string) => void;
  showTryOn?: boolean;
}

export const ProductCard: React.FC<ProductCardProps> = ({
  product,
  onAddToCart,
  onViewDetails,
  onTryOn,
  showTryOn = false,
}) => {
  const {
    id,
    name,
    description,
    price,
    originalPrice,
    currency,
    imageUrl,
    platform,
    rating,
    reviewCount,
    inStock,
    discount,
  } = product;

  const hasDiscount = originalPrice && originalPrice > price;

  return (
    <div className="group relative bg-white rounded-lg shadow-md hover:shadow-lg transition-all duration-300 overflow-hidden border border-gray-200">
      {/* Discount Badge */}
      {hasDiscount && (
        <div className="absolute top-2 left-2 z-10 bg-red-500 text-white text-xs font-bold px-2 py-1 rounded-full">
          -{Math.round(((originalPrice! - price) / originalPrice!) * 100)}%
        </div>
      )}

      {/* Platform Badge */}
      <div className="absolute top-2 right-2 z-10 bg-blue-500 text-white text-xs font-medium px-2 py-1 rounded-full">
        {platform}
      </div>

      {/* Product Image */}
      <div className="relative aspect-square overflow-hidden bg-gray-100">
        <Image
          src={imageUrl}
          alt={name}
          fill
          className="object-cover group-hover:scale-105 transition-transform duration-300"
          sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
        />
        
        {/* Quick Actions Overlay */}
        <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-20 transition-all duration-300 flex items-center justify-center">
          <div className="opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex gap-2">
            <Button
              size="sm"
              variant="secondary"
              onClick={() => onViewDetails?.(id)}
              className="bg-white text-gray-900 hover:bg-gray-100"
            >
              View
            </Button>
            {showTryOn && onTryOn && (
              <Button
                size="sm"
                variant="gradient"
                onClick={() => onTryOn(id)}
              >
                Try On
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Product Info */}
      <div className="p-4">
        {/* Product Name */}
        <h3 className="font-semibold text-gray-900 text-sm mb-1 line-clamp-2">
          {truncateText(name, 60)}
        </h3>

        {/* Description */}
        <p className="text-gray-600 text-xs mb-2 line-clamp-2">
          {truncateText(description, 80)}
        </p>

        {/* Rating */}
        {rating && (
          <div className="flex items-center mb-2">
            <div className="flex items-center">
              {[...Array(5)].map((_, i) => (
                <svg
                  key={i}
                  className={`w-3 h-3 ${
                    i < Math.floor(rating)
                      ? 'text-yellow-400 fill-current'
                      : 'text-gray-300'
                  }`}
                  viewBox="0 0 20 20"
                >
                  <path d="M10 15l-5.878 3.09 1.123-6.545L.489 6.91l6.572-.955L10 0l2.939 5.955 6.572.955-4.756 4.635 1.123 6.545z" />
                </svg>
              ))}
            </div>
            {reviewCount && (
              <span className="text-xs text-gray-500 ml-1">
                ({reviewCount})
              </span>
            )}
          </div>
        )}

        {/* Price */}
        <div className="flex items-center gap-2 mb-3">
          <span className="text-lg font-bold text-gray-900">
            {formatPrice(price, currency)}
          </span>
          {hasDiscount && (
            <span className="text-sm text-gray-500 line-through">
              {formatPrice(originalPrice!, currency)}
            </span>
          )}
        </div>

        {/* Stock Status */}
        <div className="flex items-center justify-between mb-3">
          <span
            className={`text-xs font-medium ${
              inStock ? 'text-green-600' : 'text-red-600'
            }`}
          >
            {inStock ? 'In Stock' : 'Out of Stock'}
          </span>
        </div>

        {/* Action Buttons */}
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            className="flex-1"
            onClick={() => onViewDetails?.(id)}
          >
            Details
          </Button>
          <Button
            size="sm"
            className="flex-1"
            disabled={!inStock}
            onClick={() => onAddToCart?.(id)}
          >
            Add to Cart
          </Button>
        </div>
      </div>
    </div>
  );
}; 