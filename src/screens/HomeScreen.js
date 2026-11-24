import React, {useState, useRef, useEffect} from 'react';

import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  FlatList,
  StyleSheet,
  StatusBar,
  Alert,
  Dimensions,
} from 'react-native';

import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {useIsFocused} from '@react-navigation/native';
import colors from '../theme/colors';
import AddressBottomSheet from '../components/AddressBottomSheet';
import AddControl from '../components/AddControl';
import CartBar from '../components/CartBar';
import VoiceSearchModal from '../components/VoiceSearchModal';
import {useCart} from '../context/CartContext';
import {categories, fruits, deals, discountPercent} from '../data/fruits';
import {
  loadAddressState,
  syncAddressStateWithServer,
} from '../utils/addressHelpers';

const SCREEN_WIDTH = Dimensions.get('window').width;
const SLIDE_GAP = 12;
const SLIDE_WIDTH = SCREEN_WIDTH - 40;
const SLIDE_INTERVAL = SLIDE_WIDTH + SLIDE_GAP;

/* ---------------- HOME SCREEN ---------------- */

const HomeScreen = ({navigation, route}) => {
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [activeDeal, setActiveDeal] = useState(0);
  const [voiceVisible, setVoiceVisible] = useState(false);

  // Cart is shared with the Search screen through context.
  const {cart, addToCart, removeFromCart, cartCount} = useCart();

  // Refs for the automatic deals slider.
  const dealListRef = useRef(null);
  const dealIndex = useRef(0);

  // Status bar / safe area handling: the green header extends under the
  // status bar and scrolls away with the content.
  const insets = useSafeAreaInsets();
  const [scrolled, setScrolled] = useState(false);

  // Only the focused tab controls the status bar (Profile does the same).
  const isFocused = useIsFocused();

  const onScroll = event => {
    const isScrolled = event.nativeEvent.contentOffset.y > 120;

    if (isScrolled !== scrolled) {
      setScrolled(isScrolled);
    }
  };

  // Delivery addresses (shared with ProfileScreen through AsyncStorage).
  const [addresses, setAddresses] = useState([]);
  const [selectedAddressId, setSelectedAddressId] = useState(null);
  const [addressSheetVisible, setAddressSheetVisible] = useState(false);

  const selectedAddress =
    addresses.find(item => item.id === selectedAddressId) || null;
  const deliveryAddress = selectedAddress ? selectedAddress.fullAddress : '';
  const addressTitle = selectedAddress ? selectedAddress.label : '';

  // Deals + bulk banner are only shown on the "All" view, so a selected
  // category shows its products right under the category row.
  const showPromos = selectedCategory === 'All';

  // Load saved addresses, and refresh whenever this screen regains focus
  // (for example after the user edits addresses in Profile).
  useEffect(() => {
    let active = true;

    const refreshAddresses = async () => {
      try {
        // 1. Show what is on the phone straight away.
        const state = await loadAddressState();

        if (active) {
          setAddresses(state.addresses);
          setSelectedAddressId(state.selectedId);
        }

        // 2. Then bring in the addresses saved on the server (Firebase).
        const synced = await syncAddressStateWithServer();

        if (active && synced) {
          setAddresses(synced.addresses);
          setSelectedAddressId(synced.selectedId);
        }
      } catch (error) {
        console.log('Address loading error:', error);
      }
    };

    refreshAddresses();

    const unsubscribe = navigation?.addListener?.('focus', refreshAddresses);

    return () => {
      active = false;

      if (typeof unsubscribe === 'function') {
        unsubscribe();
      }
    };
  }, [navigation]);

  // Called by the address sheet after add / edit / delete / select.
  const handleAddressChange = (updatedAddresses, updatedSelectedId) => {
    setAddresses(updatedAddresses);
    setSelectedAddressId(updatedSelectedId);
  };

  // Automatic deals slider (only runs while the deals are visible).
  useEffect(() => {
    if (deals.length === 0 || !showPromos) {
      return;
    }

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
  }, [showPromos]);

  // Reset deals position whenever the deals come back into view.
  useEffect(() => {
    if (showPromos) {
      dealIndex.current = 0;
      setActiveDeal(0);
    }
  }, [showPromos]);

  const onDealScrollEnd = event => {
    const index = Math.round(
      event.nativeEvent.contentOffset.x / SLIDE_INTERVAL,
    );

    dealIndex.current = index;
    setActiveDeal(index);
  };

  const onAddressPress = () => {
    setAddressSheetVisible(true);
  };

  // Tapping the search bar opens the dedicated Search page.
  const openSearch = () => {
    navigation.navigate('Search');
  };

  // Mic opens the listening sheet right here on Home.
  const openVoice = () => {
    setVoiceVisible(true);
  };

  // Once speech is recognised, close the sheet and show results on Search.
  const handleVoiceResult = text => {
    setVoiceVisible(false);
    navigation.navigate('Search', {query: text, fromVoice: true});
  };

  // Category filtering.
  const filteredFruits = fruits.filter(
    item => selectedCategory === 'All' || item.category === selectedCategory,
  );

  // Deal card.
  const renderDeal = ({item}) => (
    <View style={[styles.dealCard, {backgroundColor: item.bg}]}>
      <View style={styles.dealContent}>
        <View style={styles.dealBadge}>
          <Text style={styles.dealDiscount}>{discountPercent(item)}% OFF</Text>
        </View>

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
    <View style={styles.safeArea}>
      {isFocused && (
        <StatusBar
          translucent
          backgroundColor="transparent"
          barStyle={scrolled ? 'dark-content' : 'light-content'}
        />
      )}

      <View style={styles.container}>
        <ScrollView
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          onScroll={onScroll}
          scrollEventThrottle={16}
          contentContainerStyle={{paddingBottom: cartCount > 0 ? 100 : 24}}>
          {/* GREEN DELIVERY HEADER */}
          <View style={[styles.header, {paddingTop: insets.top + 10}]}>
            <Text style={styles.deliveryEyebrow}>DKD Fruits delivers</Text>

            <Text style={styles.deliveryTime}>Freshness at your door</Text>

            {/* ADDRESS PILL */}
            <TouchableOpacity
              style={styles.addressPill}
              activeOpacity={0.8}
              onPress={onAddressPress}>
              <View style={styles.addressIconWrap}>
                <MaterialCommunityIcons
                  name="map-marker"
                  size={18}
                  color={colors.primary}
                />
              </View>

              <View style={styles.addressTextBlock}>
                <Text style={styles.addressTitle} numberOfLines={1}>
                  {deliveryAddress
                    ? `Deliver to ${addressTitle}`
                    : 'Select your delivery address'}
                </Text>

                <Text style={styles.addressText} numberOfLines={1}>
                  {deliveryAddress || 'Tap to add your address'}
                </Text>
              </View>

              <MaterialCommunityIcons
                name="chevron-down"
                size={22}
                color={colors.white}
              />
            </TouchableOpacity>

            {/* SEARCH BAR (opens the Search page) */}
            <TouchableOpacity
              style={styles.searchContainer}
              activeOpacity={0.9}
              onPress={openSearch}>
              <MaterialCommunityIcons
                name="magnify"
                size={24}
                color="#333333"
              />

              <Text style={styles.searchPlaceholder}>Search "apple"</Text>

              <TouchableOpacity
                style={styles.micButton}
                activeOpacity={0.7}
                onPress={openVoice}>
                <MaterialCommunityIcons
                  name="microphone"
                  size={24}
                  color="#222222"
                />
              </TouchableOpacity>
            </TouchableOpacity>
          </View>

          {/* CATEGORIES */}
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Shop by Category</Text>
            <Text style={styles.sectionHint}>Fresh today</Text>
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
                  onPress={() =>
                    setSelectedCategory(
                      active && category.name !== 'All' ? 'All' : category.name,
                    )
                  }
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

          {/* DEALS + BULK ENQUIRY: only on the "All" view */}
          {showPromos && (
            <>
              {/* TODAY'S DEALS */}
              <View style={styles.sectionHeader}>
                <View>
                  <Text style={styles.sectionTitle}>Today's Deals</Text>
                  <Text style={styles.sectionSub}>
                    Special offers you don't want to miss
                  </Text>
                </View>

                <View style={styles.liveBadge}>
                  <View style={styles.liveDot} />
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
                ItemSeparatorComponent={() => (
                  <View style={{width: SLIDE_GAP}} />
                )}
                onMomentumScrollEnd={onDealScrollEnd}
              />

              <View style={styles.dots}>
                {deals.map((item, index) => (
                  <View
                    key={item.id}
                    style={[
                      styles.dot,
                      index === activeDeal && styles.dotActive,
                    ]}
                  />
                ))}
              </View>

              {/* BULK ENQUIRY */}
              <View style={styles.bulkBanner}>
                <View style={styles.bulkIconWrap}>
                  <MaterialCommunityIcons
                    name="truck-delivery-outline"
                    size={26}
                    color="#FFFFFF"
                  />
                </View>

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
                    Alert.alert(
                      'Bulk Enquiry',
                      'Our team will contact you soon.',
                    )
                  }>
                  <Text style={styles.bulkButtonText}>Inquire →</Text>
                </TouchableOpacity>
              </View>
            </>
          )}

          {/* FRUIT PRODUCTS */}
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle} numberOfLines={1}>
              {selectedCategory === 'All' ? 'All Fruits' : selectedCategory}
            </Text>

            <Text style={styles.sectionHint}>
              {filteredFruits.length} products
            </Text>
          </View>

          <View style={styles.productGrid}>
            {filteredFruits.map(fruit => {
              const off = discountPercent(fruit);

              return (
                <View key={fruit.id} style={styles.productCard}>
                  <View
                    style={[styles.productImage, {backgroundColor: fruit.bg}]}>
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

                      {off > 0 && <Text style={styles.mrp}>₹{fruit.mrp}</Text>}
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

          {/* FOOTER */}
          <View style={styles.footer}>
            <Text style={styles.footerTitle}>DKD Fruits & Vegetables</Text>
            <Text style={styles.footerText}>
              Trusted Since 1938 | Import | Export
            </Text>
          </View>
        </ScrollView>

        {/* Keeps status bar icons readable once the green header scrolls away */}
        {scrolled && (
          <View
            pointerEvents="none"
            style={[styles.statusBarCover, {height: insets.top}]}
          />
        )}

        {/* FLOATING CART BAR */}
        <CartBar bottom={16} />
      </View>

      {/* VOICE SEARCH SHEET (listens on Home, results open on Search) */}
      <VoiceSearchModal
        visible={voiceVisible}
        onClose={() => setVoiceVisible(false)}
        onResult={handleVoiceResult}
      />

      {/* DELIVERY ADDRESS BOTTOM SHEET */}
      <AddressBottomSheet
        visible={addressSheetVisible}
        onClose={() => setAddressSheetVisible(false)}
        addresses={addresses}
        selectedId={selectedAddressId}
        onChange={handleAddressChange}
      />
    </View>
  );
};

/* ---------------- STYLES ---------------- */

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.background,
  },

  statusBarCover: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    backgroundColor: colors.background,
  },

  container: {
    flex: 1,
    backgroundColor: colors.background,
  },

  /* HEADER */
  header: {
    backgroundColor: colors.primary,
    paddingHorizontal: 20,
    paddingBottom: 22,
    borderBottomLeftRadius: 26,
    borderBottomRightRadius: 26,
  },

  deliveryEyebrow: {
    color: 'rgba(255,255,255,0.85)',
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 0.3,
  },

  deliveryTime: {
    color: colors.white,
    fontSize: 26,
    fontWeight: '900',
    marginTop: 2,
  },

  /* ADDRESS PILL */
  addressPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.16)',
    borderRadius: 14,
    paddingVertical: 9,
    paddingHorizontal: 10,
    marginTop: 14,
    marginBottom: 14,
  },

  addressIconWrap: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },

  addressTextBlock: {
    flex: 1,
    marginLeft: 10,
    marginRight: 6,
  },

  addressTitle: {
    color: colors.white,
    fontSize: 13,
    fontWeight: '800',
  },

  addressText: {
    color: 'rgba(255,255,255,0.85)',
    fontSize: 12,
    marginTop: 2,
  },

  /* SEARCH */
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 15,
    paddingHorizontal: 15,
    height: 54,
    elevation: 4,
    shadowColor: '#000000',
    shadowOpacity: 0.12,
    shadowRadius: 8,
    shadowOffset: {width: 0, height: 3},
  },

  searchPlaceholder: {
    flex: 1,
    fontSize: 15,
    color: '#888888',
    marginLeft: 10,
  },

  micButton: {
    width: 42,
    height: 42,
    alignItems: 'center',
    justifyContent: 'center',
    borderLeftWidth: 1,
    borderLeftColor: '#EEEEEE',
    marginLeft: 8,
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
    flexShrink: 1,
    paddingRight: 10,
  },

  sectionHint: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.primary,
  },

  sectionSub: {
    color: colors.gray,
    fontSize: 12,
    marginTop: 3,
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

  /* DEALS */
  dealList: {
    paddingHorizontal: 20,
  },

  dealCard: {
    width: SLIDE_WIDTH,
    minHeight: 168,
    borderRadius: 20,
    padding: 18,
    flexDirection: 'row',
    alignItems: 'center',
  },

  dealContent: {
    flex: 1,
  },

  dealBadge: {
    alignSelf: 'flex-start',
    backgroundColor: colors.primary,
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },

  dealDiscount: {
    color: colors.white,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.6,
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

  liveBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEE4E2',
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 6,
  },

  liveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#B42318',
    marginRight: 5,
  },

  liveText: {
    color: '#B42318',
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 0.5,
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

  /* BULK ENQUIRY */
  bulkBanner: {
    marginHorizontal: 20,
    marginTop: 22,
    backgroundColor: '#194D2E',
    borderRadius: 18,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
  },

  bulkIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },

  bulkContent: {
    flex: 1,
    paddingRight: 8,
  },

  bulkTitle: {
    color: colors.white,
    fontSize: 16,
    fontWeight: '900',
  },

  bulkText: {
    color: '#DDEBDD',
    fontSize: 11,
    marginTop: 4,
  },

  bulkButton: {
    backgroundColor: colors.white,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },

  bulkButtonText: {
    color: '#194D2E',
    fontWeight: '900',
    fontSize: 12,
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
    borderRadius: 18,
    padding: 10,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: colors.border,
    elevation: 2,
    shadowColor: '#000000',
    shadowOpacity: 0.06,
    shadowRadius: 6,
    shadowOffset: {width: 0, height: 2},
  },

  productImage: {
    height: 112,
    borderRadius: 14,
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
    borderTopLeftRadius: 14,
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
});

export default HomeScreen;