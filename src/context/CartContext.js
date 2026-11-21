import React, {createContext, useContext, useState, useMemo, useCallback} from 'react';
import {fruits} from '../data/fruits';

const CartContext = createContext(null);

export const CartProvider = ({children}) => {
  const [cart, setCart] = useState({});

  const addToCart = useCallback(id => {
    setCart(previous => ({
      ...previous,
      [id]: (previous[id] || 0) + 1,
    }));
  }, []);

  const removeFromCart = useCallback(id => {
    setCart(previous => {
      const quantity = (previous[id] || 0) - 1;
      const next = {...previous};

      if (quantity <= 0) {
        delete next[id];
      } else {
        next[id] = quantity;
      }

      return next;
    });
  }, []);

  const cartCount = useMemo(
    () => Object.values(cart).reduce((sum, qty) => sum + qty, 0),
    [cart],
  );

  const cartTotal = useMemo(
    () =>
      fruits.reduce((sum, item) => sum + item.price * (cart[item.id] || 0), 0),
    [cart],
  );

  const value = useMemo(
    () => ({cart, addToCart, removeFromCart, cartCount, cartTotal}),
    [cart, addToCart, removeFromCart, cartCount, cartTotal],
  );

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
};

export const useCart = () => {
  const context = useContext(CartContext);

  if (!context) {
    throw new Error('useCart must be used inside <CartProvider>');
  }

  return context;
};
