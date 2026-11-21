import React from 'react';
import {View, Text, TouchableOpacity, Alert, StyleSheet} from 'react-native';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import colors from '../theme/colors';
import {useCart} from '../context/CartContext';

const CartBar = ({bottom = 16}) => {
  const {cartCount, cartTotal} = useCart();

  if (cartCount === 0) {
    return null;
  }

  return (
    <TouchableOpacity
      style={[styles.cartBar, {bottom}]}
      activeOpacity={0.9}
      onPress={() =>
        Alert.alert(
          'Your Cart',
          `${cartCount} item${cartCount > 1 ? 's' : ''} • ₹${cartTotal}`,
        )
      }>
      <View>
        <Text style={styles.cartBarCount}>
          {cartCount} item{cartCount > 1 ? 's' : ''}
        </Text>
        <Text style={styles.cartBarTotal}>₹{cartTotal}</Text>
      </View>

      <View style={styles.cartBarAction}>
        <Text style={styles.cartBarActionText}>View Cart</Text>
        <MaterialCommunityIcons
          name="chevron-right"
          size={20}
          color="#FFFFFF"
        />
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  cartBar: {
    position: 'absolute',
    left: 20,
    right: 20,
    backgroundColor: colors.primary,
    borderRadius: 16,
    paddingVertical: 12,
    paddingHorizontal: 18,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    elevation: 8,
    shadowColor: '#000000',
    shadowOpacity: 0.25,
    shadowRadius: 10,
    shadowOffset: {width: 0, height: 4},
  },

  cartBarCount: {
    color: 'rgba(255,255,255,0.85)',
    fontSize: 12,
    fontWeight: '700',
  },

  cartBarTotal: {
    color: colors.white,
    fontSize: 18,
    fontWeight: '900',
  },

  cartBarAction: {
    flexDirection: 'row',
    alignItems: 'center',
  },

  cartBarActionText: {
    color: colors.white,
    fontSize: 15,
    fontWeight: '800',
  },
});

export default CartBar;
