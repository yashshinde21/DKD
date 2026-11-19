import React, {useState, useRef, useEffect} from 'react';

import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  FlatList,
  StyleSheet,
  StatusBar,
  Alert,
  Dimensions,
  Platform,
} from 'react-native';

import colors from '../theme/colors';

/* ---------- DATA ---------- */

// Seasonal fruit categories (edit this list as the season changes)
const categories = [
  {name: 'All', emoji: '🧺'},
  {name: 'Apples', emoji: '🍎'},
  {name: 'Oranges', emoji: '🍊'},
  {name: 'Grapes', emoji: '🍇'},
  {name: 'Guava', emoji: '🍐'},
  {name: 'Strawberry', emoji: '🍓'},
  {name: 'Kiwi', emoji: '🥝'},
  {name: 'Sweet Lime', emoji: '🍋'},
];

// price = selling price, mrp = original price (mrp > price means discount)
// bg = soft card tint used in the deals slider
const fruits = [
  {
    id: '1',
    name: 'Shimla Apples',
    category: 'Apples',
    price: 180,
    mrp: 220,
    unit: 'kg',
    emoji: '🍎',
    description: 'Crisp and juicy',
    bg: '#E1F1DC',
  },
  {
    id: '2',
    name: 'Kashmiri Apples',
    category: 'Apples',
    price: 240,
    mrp: 240,
    unit: 'kg',
    emoji: '🍎',
    description: 'Sweet and firm',
    bg: '#E1F1DC',
  },
  {
    id: '3',
    name: 'Nagpur Oranges',
    category: 'Oranges',
    price: 100,
    mrp: 130,
    unit: 'kg',
    emoji: '🍊',
    description: 'Tangy and full of juice',
    bg: '#FFEBD2',
  },
  {
    id: '4',
    name: 'Kinnow Mandarin',
    category: 'Oranges',
    price: 90,
    mrp: 90,
    unit: 'kg',
    emoji: '🍊',
    description: 'Easy to peel, very juicy',
    bg: '#FFEBD2',
  },
  {
    id: '5',
    name: 'Green Grapes',
    category: 'Grapes',
    price: 120,
    mrp: 150,
    unit: 'kg',
    emoji: '🍇',
    description: 'Sweet and seedless',
    bg: '#EDE4F7',
  },
  {
    id: '6',
    name: 'Black Grapes',
    category: 'Grapes',
    price: 140,
    mrp: 140,
    unit: 'kg',
    emoji: '🍇',
    description: 'Rich and sweet',
    bg: '#EDE4F7',
  },
  {
    id: '7',
    name: 'Pink Guava',
    category: 'Guava',
    price: 90,
    mrp: 110,
    unit: 'kg',
    emoji: '🍐',
    description: 'Fragrant and fresh',
    bg: '#DAF1EC',
  },
  {
    id: '8',
    name: 'Strawberries',
    category: 'Strawberry',
    price: 220,
    mrp: 260,
    unit: 'box',
    emoji: '🍓',
    description: 'Fresh seasonal berries',
    bg: '#FDE2DF',
  },
  {
    id: '9',
    name: 'Kiwi',
    category: 'Kiwi',
    price: 150,
    mrp: 180,
    unit: 'pack of 3',
    emoji: '🥝',
    description: 'Tangy and vitamin rich',
    bg: '#E8F2D2',
  },
  {
    id: '10',
    name: 'Mosambi',
    category: 'Sweet Lime',
    price: 90,
    mrp: 110,
    unit: 'kg',
    emoji: '🍋',
    description: 'Fresh sweet lime',
    bg: '#FBF0CC',
  },
];

const discountPercent = item =>
  item.mrp > item.price
    ? Math.round(((item.mrp - item.price) / item.mrp) * 100)
    : 0;

// Top discounted items for the slider
const deals = fruits
  .filter(item => discountPercent(item) > 0)
  .sort((a, b) => discountPercent(b) - discountPercent(a))
  .slice(0, 5);

const SCREEN_WIDTH = Dimensions.get('window').width;
const SLIDE_GAP = 12;
const SLIDE_WIDTH = SCREEN_WIDTH - 40;
const SLIDE_INTERVAL = SLIDE_WIDTH + SLIDE_GAP;

/* ---------- ADD / QUANTITY CONTROL ---------- */

const AddControl = ({qty, onAdd, onRemove, onDark, color}) => {
  if (qty === 0) {
    return (
      <TouchableOpacity
        style={[
          styles.addButton,
          onDark
            ? {backgroundColor: colors.white}
            : {borderColor: color, borderWidth: 1},
        ]}
        onPress={onAdd}
        activeOpacity={0.85}>
        <Text style={[styles.addButtonText, {color}]}>ADD</Text>
      </TouchableOpacity>
    );
  }

  const background = onDark ? colors.white : color;
  const textColor = onDark ? color : colors.white;

  return (
    <View style={[styles.stepper, {backgroundColor: background}]}>
      <TouchableOpacity
        style={styles.stepperButton}
        onPress={onRemove}
        hitSlop={{top: 8, bottom: 8, left: 8, right: 8}}>
        <Text style={[styles.stepperSymbol, {color: textColor}]}>−</Text>
      </TouchableOpacity>

      <Text style={[styles.stepperQty, {color: textColor}]}>{qty}</Text>

      <TouchableOpacity
        style={styles.stepperButton}
        onPress={onAdd}
        hitSlop={{top: 8, bottom: 8, left: 8, right: 8}}>
        <Text style={[styles.stepperSymbol, {color: textColor}]}>+</Text>
      </TouchableOpacity>
    </View>
  );
};

/* ---------- SCREEN ---------- */

const HomeScreen = ({navigation, route}) => {
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [search, setSearch] = useState('');
  const [cart, setCart] = useState({});
  const [activeDeal, setActiveDeal] = useState(0);

  const dealListRef = useRef(null);
  const dealIndex = useRef(0);

  const mode = route?.params?.mode || 'Retail';
  const customerName = route?.params?.name || 'Customer';

  // Auto-slide the discount banner
  useEffect(() => {
    const timer = setInterval(() => {
      const next = (dealIndex.current + 1) % deals.length;
      dealListRef.current?.scrollToOffset({
        offset: next * SLIDE_INTERVAL,
        animated: true,
      });
      dealIndex.current = next;
      setActiveDeal(next);
    }, 3500);

    return () => clearInterval(timer);
  }, []);

  const onDealScrollEnd = event => {
    const index = Math.round(
      event.nativeEvent.contentOffset.x / SLIDE_INTERVAL,
    );
    dealIndex.current = index;
    setActiveDeal(index);
  };

  const addToCart = id =>
    setCart(previous => ({...previous, [id]: (previous[id] || 0) + 1}));

  const removeFromCart = id =>
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

  const cartCount = Object.values(cart).reduce((sum, qty) => sum + qty, 0);
  const cartTotal = fruits.reduce(
    (sum, item) => sum + item.price * (cart[item.id] || 0),
    0,
  );

  const query = search.trim().toLowerCase();
  const filteredFruits = fruits.filter(item => {
    const matchesCategory =
      selectedCategory === 'All' || item.category === selectedCategory;
    const matchesSearch =
      !query ||
      item.name.toLowerCase().includes(query) ||
      item.category.toLowerCase().includes(query);
    return matchesCategory && matchesSearch;
  });

  const renderDeal = ({item}) => (
    <View style={[styles.dealCard, {backgroundColor: item.bg}]}>
      <View style={styles.dealContent}>
        <Text style={styles.dealDiscount}>{discountPercent(item)}% OFF</Text>

        <Text style={styles.dealName}>{item.name}</Text>
        <Text style={styles.dealDescription}>{item.description}</Text>

        <View style={styles.dealPriceRow}>
          <Text style={styles.dealPrice}>₹{item.price}</Text>
          <Text style={styles.dealMrp}>₹{item.mrp}</Text>
          <Text style={styles.dealUnit}>/ {item.unit}</Text>
        </View>

        <View style={styles.dealAction}>
          <AddControl
            qty={cart[item.id] || 0}
            onAdd={() => addToCart(item.id)}
            onRemove={() => removeFromCart(item.id)}
            onDark
            color={colors.primary}
          />
        </View>
      </View>

      <Text style={styles.dealEmoji}>{item.emoji}</Text>
    </View>
  );

  return (
    <View style={styles.container}>
      <StatusBar backgroundColor={colors.primary} barStyle="light-content" />

      <ScrollView
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{paddingBottom: cartCount > 0 ? 90 : 20}}>
        {/* HEADER */}
        <View style={styles.header}>
          <View style={styles.headerTop}>
            <View style={styles.headerText}>
              <Text style={styles.hello} numberOfLines={1}>
                Hello, {customerName} 👋
              </Text>
              <View style={styles.headerSubRow}>
                <Text style={styles.headerSub}>Fresh from DKD Fruits</Text>
                <View style={styles.modeBadge}>
                  <Text style={styles.modeText}>{mode}</Text>
                </View>
              </View>
            </View>

            <TouchableOpacity
              style={styles.cartButton}
              onPress={() =>
                Alert.alert(
                  'My Cart',
                  `${cartCount} items • ₹${cartTotal}`,
                )
              }>
              <Text style={styles.cartIcon}>🛒</Text>
              {cartCount > 0 && (
                <View style={styles.cartBadge}>
                  <Text style={styles.cartBadgeText}>{cartCount}</Text>
                </View>
              )}
            </TouchableOpacity>
          </View>

          {/* SEARCH */}
          <View style={styles.searchContainer}>
            <Text style={styles.searchIcon}>🔍</Text>
            <TextInput
              style={styles.searchInput}
              placeholder='Search "apples"'
              placeholderTextColor={colors.gray}
              value={search}
              onChangeText={setSearch}
              returnKeyType="search"
            />
            {!!search && (
              <TouchableOpacity onPress={() => setSearch('')}>
                <Text style={styles.clearText}>✕</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* SEASONAL CATEGORIES */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Seasonal Fruits</Text>
          <Text style={styles.sectionHint}>In season now</Text>
        </View>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.categoryList}>
          {categories.map(category => {
            const active = selectedCategory === category.name;
            return (
              <TouchableOpacity
                key={category.name}
                style={styles.categoryItem}
                onPress={() => setSelectedCategory(category.name)}
                activeOpacity={0.8}>
                <View
                  style={[
                    styles.categoryCircle,
                    active && styles.categoryCircleActive,
                  ]}>
                  <Text style={styles.categoryEmoji}>{category.emoji}</Text>
                </View>
                <Text
                  style={[
                    styles.categoryText,
                    active && styles.categoryTextActive,
                  ]}
                  numberOfLines={1}>
                  {category.name}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        {/* DISCOUNT SLIDER */}
        <View style={styles.sectionHeader}>
          <View>
            <Text style={styles.sectionTitle}>Today's Deals</Text>
            <Text style={styles.sectionSub}>
              Special offers you don't want to miss
            </Text>
          </View>
          <View style={styles.liveBadge}>
            <Text style={styles.liveText}>LIVE</Text>
          </View>
        </View>

        <FlatList
          ref={dealListRef}
          data={deals}
          renderItem={renderDeal}
          keyExtractor={item => item.id}
          horizontal
          showsHorizontalScrollIndicator={false}
          snapToInterval={SLIDE_INTERVAL}
          decelerationRate="fast"
          disableIntervalMomentum
          contentContainerStyle={styles.dealList}
          ItemSeparatorComponent={() => <View style={{width: SLIDE_GAP}} />}
          onMomentumScrollEnd={onDealScrollEnd}
        />

        <View style={styles.dots}>
          {deals.map((item, index) => (
            <View
              key={item.id}
              style={[styles.dot, index === activeDeal && styles.dotActive]}
            />
          ))}
        </View>

        {/* BULK ENQUIRY */}
        <View style={styles.bulkBanner}>
          <View style={styles.bulkContent}>
            <Text style={styles.bulkTitle}>Buying in bulk?</Text>
            <Text style={styles.bulkText}>
              For shops, retailers and business orders.
            </Text>
          </View>

          <TouchableOpacity
            style={styles.bulkButton}
            activeOpacity={0.85}
            onPress={() =>
              Alert.alert('Bulk Enquiry', 'Our team will contact you soon.')
            }>
            <Text style={styles.bulkButtonText}>Add Enquiry →</Text>
          </TouchableOpacity>
        </View>

        {/* PRODUCTS */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>
            {selectedCategory === 'All' ? 'All Fruits' : selectedCategory}
          </Text>
          <Text style={styles.sectionHint}>
            {filteredFruits.length} products
          </Text>
        </View>

        {filteredFruits.length === 0 ? (
          <Text style={styles.emptyText}>No fruits found.</Text>
        ) : (
          <View style={styles.productGrid}>
            {filteredFruits.map(fruit => {
              const off = discountPercent(fruit);
              return (
                <View key={fruit.id} style={styles.productCard}>
                  <View style={styles.productImage}>
                    {off > 0 && (
                      <View style={styles.offBadge}>
                        <Text style={styles.offBadgeText}>{off}% OFF</Text>
                      </View>
                    )}
                    <Text style={styles.fruitEmoji}>{fruit.emoji}</Text>
                  </View>

                  <Text style={styles.productUnit}>{fruit.unit}</Text>
                  <Text style={styles.productName} numberOfLines={1}>
                    {fruit.name}
                  </Text>
                  <Text style={styles.productDescription} numberOfLines={1}>
                    {fruit.description}
                  </Text>

                  <View style={styles.productBottom}>
                    <View>
                      <Text style={styles.price}>₹{fruit.price}</Text>
                      {off > 0 && (
                        <Text style={styles.mrp}>₹{fruit.mrp}</Text>
                      )}
                    </View>

                    <AddControl
                      qty={cart[fruit.id] || 0}
                      onAdd={() => addToCart(fruit.id)}
                      onRemove={() => removeFromCart(fruit.id)}
                      color={colors.primary}
                    />
                  </View>
                </View>
              );
            })}
          </View>
        )}

        {/* FOOTER */}
        <View style={styles.footer}>
          <Text style={styles.footerTitle}>DKD Fruits & Vegetables</Text>
          <Text style={styles.footerText}>
            Trusted Since 1938 | Import | Export
          </Text>
        </View>
      </ScrollView>

      {/* FLOATING CART BAR */}
      {cartCount > 0 && (
        <TouchableOpacity
          style={styles.cartBar}
          activeOpacity={0.9}
          onPress={() =>
            Alert.alert('My Cart', `${cartCount} items • ₹${cartTotal}`)
          }>
          <View>
            <Text style={styles.cartBarItems}>
              {cartCount} {cartCount === 1 ? 'item' : 'items'}
            </Text>
            <Text style={styles.cartBarTotal}>₹{cartTotal}</Text>
          </View>
          <Text style={styles.cartBarAction}>View Cart  ›</Text>
        </TouchableOpacity>
      )}
    </View>
  );
};

/* ---------- STYLES ---------- */

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },

  /* HEADER */
  header: {
    backgroundColor: colors.primary,
    paddingTop: Platform.OS === 'ios' ? 60 : 44,
    paddingHorizontal: 20,
    paddingBottom: 20,
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
  },

  headerTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },

  headerText: {
    flex: 1,
    paddingRight: 12,
  },

  hello: {
    fontSize: 20,
    fontWeight: '800',
    color: colors.white,
  },

  headerSubRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 6,
  },

  headerSub: {
    fontSize: 12,
    color: colors.white,
    opacity: 0.85,
  },

  modeBadge: {
    marginLeft: 8,
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.2)',
  },

  modeText: {
    color: colors.white,
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.5,
  },

  cartButton: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },

  cartIcon: {
    fontSize: 21,
  },

  cartBadge: {
    position: 'absolute',
    top: -5,
    right: -5,
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    paddingHorizontal: 5,
    backgroundColor: '#F5D66D',
    alignItems: 'center',
    justifyContent: 'center',
  },

  cartBadgeText: {
    fontSize: 11,
    fontWeight: '800',
    color: colors.black,
  },

  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.white,
    borderRadius: 12,
    height: 48,
    paddingHorizontal: 14,
    marginTop: 18,
  },

  searchIcon: {
    fontSize: 16,
  },

  searchInput: {
    flex: 1,
    marginLeft: 10,
    color: colors.text,
    fontSize: 14,
  },

  clearText: {
    color: colors.gray,
    fontSize: 14,
    paddingLeft: 8,
  },

  /* SECTION HEADERS */
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    marginTop: 24,
    marginBottom: 12,
  },

  sectionTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: colors.black,
  },

  sectionHint: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.primary,
  },

  /* CATEGORIES */
  categoryList: {
    paddingHorizontal: 20,
  },

  categoryItem: {
    alignItems: 'center',
    width: 72,
    marginRight: 10,
  },

  categoryCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: 'transparent',
  },

  categoryCircleActive: {
    borderColor: colors.primary,
    backgroundColor: colors.white,
  },

  categoryEmoji: {
    fontSize: 30,
  },

  categoryText: {
    marginTop: 7,
    fontSize: 12,
    fontWeight: '600',
    color: colors.gray,
  },

  categoryTextActive: {
    color: colors.primary,
    fontWeight: '800',
  },

  /* DEALS SLIDER */
  dealList: {
    paddingHorizontal: 20,
  },

  dealCard: {
    width: SLIDE_WIDTH,
    minHeight: 160,
    borderRadius: 18,
    padding: 18,
    flexDirection: 'row',
    alignItems: 'center',
  },

  dealContent: {
    flex: 1,
  },

  dealDiscount: {
    color: colors.primary,
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.8,
  },

  dealName: {
    color: colors.black,
    fontSize: 20,
    fontWeight: '900',
    marginTop: 8,
  },

  dealDescription: {
    color: colors.gray,
    fontSize: 12,
    marginTop: 4,
  },

  dealPriceRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    marginTop: 10,
  },

  dealPrice: {
    color: colors.black,
    fontSize: 20,
    fontWeight: '900',
  },

  dealMrp: {
    color: colors.gray,
    fontSize: 13,
    marginLeft: 8,
    marginBottom: 2,
    textDecorationLine: 'line-through',
  },

  dealUnit: {
    color: colors.gray,
    fontSize: 11,
    marginLeft: 6,
    marginBottom: 3,
  },

  dealAction: {
    marginTop: 14,
    alignSelf: 'flex-start',
  },

  dealEmoji: {
    fontSize: 78,
    marginLeft: 6,
  },

  sectionSub: {
    color: colors.gray,
    fontSize: 12,
    marginTop: 3,
  },

  liveBadge: {
    backgroundColor: '#FEE4E2',
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 6,
  },

  liveText: {
    color: '#B42318',
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 0.5,
  },

  /* BULK ENQUIRY */
  bulkBanner: {
    marginHorizontal: 20,
    marginTop: 22,
    backgroundColor: '#194D2E',
    borderRadius: 16,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
  },

  bulkContent: {
    flex: 1,
    paddingRight: 10,
  },

  bulkTitle: {
    color: colors.white,
    fontSize: 17,
    fontWeight: '900',
  },

  bulkText: {
    color: '#DDEBDD',
    fontSize: 11,
    marginTop: 5,
  },

  bulkButton: {
    backgroundColor: colors.white,
    borderRadius: 9,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },

  bulkButtonText: {
    color: '#194D2E',
    fontWeight: '900',
    fontSize: 11,
  },

  dots: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 12,
  },

  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.border,
    marginHorizontal: 3,
  },

  dotActive: {
    width: 18,
    backgroundColor: colors.primary,
  },

  /* ADD / STEPPER */
  addButton: {
    minWidth: 76,
    height: 34,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 14,
  },

  addButtonText: {
    fontSize: 13,
    fontWeight: '900',
    letterSpacing: 0.5,
  },

  stepper: {
    minWidth: 76,
    height: 34,
    borderRadius: 9,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 8,
  },

  stepperButton: {
    paddingHorizontal: 4,
  },

  stepperSymbol: {
    fontSize: 18,
    fontWeight: '800',
  },

  stepperQty: {
    fontSize: 14,
    fontWeight: '800',
    marginHorizontal: 6,
  },

  /* PRODUCTS */
  productGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
  },

  productCard: {
    width: '48%',
    backgroundColor: colors.white,
    borderRadius: 16,
    padding: 10,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: colors.border,
  },

  productImage: {
    height: 112,
    backgroundColor: colors.background,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },

  offBadge: {
    position: 'absolute',
    top: 0,
    left: 0,
    backgroundColor: colors.primary,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderTopLeftRadius: 12,
    borderBottomRightRadius: 12,
  },

  offBadgeText: {
    color: colors.white,
    fontSize: 10,
    fontWeight: '800',
  },

  fruitEmoji: {
    fontSize: 54,
  },

  productUnit: {
    marginTop: 10,
    alignSelf: 'flex-start',
    fontSize: 10,
    fontWeight: '700',
    color: colors.gray,
    backgroundColor: colors.background,
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 6,
    overflow: 'hidden',
  },

  productName: {
    fontSize: 14,
    fontWeight: '800',
    color: colors.black,
    marginTop: 6,
  },

  productDescription: {
    fontSize: 11,
    color: colors.gray,
    marginTop: 3,
  },

  productBottom: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 12,
  },

  price: {
    color: colors.black,
    fontWeight: '900',
    fontSize: 16,
  },

  mrp: {
    color: colors.gray,
    fontSize: 11,
    textDecorationLine: 'line-through',
  },

  emptyText: {
    textAlign: 'center',
    color: colors.gray,
    paddingVertical: 30,
  },

  /* FOOTER */
  footer: {
    alignItems: 'center',
    paddingVertical: 22,
  },

  footerTitle: {
    color: colors.primary,
    fontWeight: '900',
    fontSize: 15,
  },

  footerText: {
    color: colors.gray,
    fontSize: 11,
    marginTop: 6,
  },

  /* FLOATING CART BAR */
  cartBar: {
    position: 'absolute',
    left: 20,
    right: 20,
    bottom: 20,
    backgroundColor: colors.primary,
    borderRadius: 14,
    paddingHorizontal: 18,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 4},
    shadowOpacity: 0.2,
    shadowRadius: 8,
  },

  cartBarItems: {
    color: colors.white,
    opacity: 0.85,
    fontSize: 11,
    fontWeight: '600',
  },

  cartBarTotal: {
    color: colors.white,
    fontSize: 17,
    fontWeight: '900',
  },

  cartBarAction: {
    color: colors.white,
    fontSize: 15,
    fontWeight: '800',
  },
});

export default HomeScreen;