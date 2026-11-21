import React, {useState, useEffect, useMemo, useRef, useCallback} from 'react';

import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  StyleSheet,
  StatusBar,
  Keyboard,
} from 'react-native';

import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';

import colors from '../theme/colors';
import AddControl from '../components/AddControl';
import CartBar from '../components/CartBar';
import {useCart} from '../context/CartContext';
import {fruits, discountPercent} from '../data/fruits';

const RECENT_KEY = '@dkd_recent_searches';
const MAX_RECENT = 6;

const POPULAR = [
  'Apple',
  'Orange',
  'Grapes',
  'Guava',
  'Strawberry',
  'Kiwi',
  'Mosambi',
];

const SearchScreen = ({navigation, route}) => {
  const insets = useSafeAreaInsets();
  const inputRef = useRef(null);

  const {cart, addToCart, removeFromCart, cartCount} = useCart();

  // Text that arrived from voice search on the Home page (if any).
  const incomingQuery = route?.params?.query?.trim() || '';

  const [search, setSearch] = useState(incomingQuery);
  const [recent, setRecent] = useState([]);

  const query = search.trim().toLowerCase();
  const isSearching = query.length > 0;

  /* ---------- recent searches ---------- */

  useEffect(() => {
    let active = true;

    const loadRecent = async () => {
      try {
        const raw = await AsyncStorage.getItem(RECENT_KEY);
        let list = raw ? JSON.parse(raw) : [];

        // A voice search counts as a recent search too.
        if (incomingQuery) {
          list = [
            incomingQuery,
            ...list.filter(
              item => item.toLowerCase() !== incomingQuery.toLowerCase(),
            ),
          ].slice(0, MAX_RECENT);

          await AsyncStorage.setItem(RECENT_KEY, JSON.stringify(list));
        }

        if (active) {
          setRecent(list);
        }
      } catch (error) {
        console.log('Recent search load error:', error);
      }
    };

    loadRecent();

    return () => {
      active = false;
    };
  }, []);

  const persistRecent = async list => {
    try {
      await AsyncStorage.setItem(RECENT_KEY, JSON.stringify(list));
    } catch (error) {
      console.log('Recent search save error:', error);
    }
  };

  const saveRecent = term => {
    const clean = term.trim();

    if (!clean) {
      return;
    }

    const next = [
      clean,
      ...recent.filter(item => item.toLowerCase() !== clean.toLowerCase()),
    ].slice(0, MAX_RECENT);

    setRecent(next);
    persistRecent(next);
  };

  const removeRecent = term => {
    const next = recent.filter(item => item !== term);

    setRecent(next);
    persistRecent(next);
  };

  const clearRecent = () => {
    setRecent([]);
    persistRecent([]);
  };

  /* ---------- results ---------- */

  const results = useMemo(() => {
    if (!isSearching) {
      return [];
    }

    const terms = query.split(/\s+/);

    return fruits.filter(item => {
      const haystack =
        `${item.name} ${item.category} ${item.description}`.toLowerCase();

      return terms.every(term => haystack.includes(term));
    });
  }, [query, isSearching]);

  const applyTerm = term => {
    setSearch(term);
    saveRecent(term);
    Keyboard.dismiss();
  };

  const goBack = useCallback(() => {
    Keyboard.dismiss();
    navigation.goBack();
  }, [navigation]);

  /* ---------- renderers ---------- */

  const renderResult = ({item}) => {
    const off = discountPercent(item);

    return (
      <View style={styles.resultRow}>
        <View style={[styles.resultImage, {backgroundColor: item.bg}]}>
          <Text style={styles.resultEmoji}>{item.emoji}</Text>
        </View>

        <View style={styles.resultInfo}>
          <Text style={styles.resultName} numberOfLines={1}>
            {item.name}
          </Text>

          <Text style={styles.resultMeta} numberOfLines={1}>
            {item.unit} • {item.description}
          </Text>

          <View style={styles.resultPriceRow}>
            <Text style={styles.resultPrice}>₹{item.price}</Text>

            {off > 0 && (
              <>
                <Text style={styles.resultMrp}>₹{item.mrp}</Text>
                <View style={styles.resultOff}>
                  <Text style={styles.resultOffText}>{off}% OFF</Text>
                </View>
              </>
            )}
          </View>
        </View>

        <AddControl
          qty={cart[item.id] || 0}
          onAdd={() => addToCart(item.id)}
          onRemove={() => removeFromCart(item.id)}
          color={colors.primary}
        />
      </View>
    );
  };

  const renderIdleState = () => (
    <View style={styles.idleWrap}>
      {recent.length > 0 && (
        <View style={styles.block}>
          <View style={styles.blockHeader}>
            <Text style={styles.blockTitle}>Recent searches</Text>

            <TouchableOpacity onPress={clearRecent} activeOpacity={0.7}>
              <Text style={styles.blockAction}>Clear all</Text>
            </TouchableOpacity>
          </View>

          {recent.map(term => (
            <TouchableOpacity
              key={term}
              style={styles.recentRow}
              activeOpacity={0.7}
              onPress={() => applyTerm(term)}>
              <MaterialCommunityIcons
                name="history"
                size={20}
                color={colors.gray}
              />

              <Text style={styles.recentText} numberOfLines={1}>
                {term}
              </Text>

              <TouchableOpacity
                onPress={() => removeRecent(term)}
                hitSlop={{top: 10, bottom: 10, left: 10, right: 10}}>
                <MaterialCommunityIcons
                  name="close"
                  size={18}
                  color={colors.gray}
                />
              </TouchableOpacity>
            </TouchableOpacity>
          ))}
        </View>
      )}

      <View style={styles.block}>
        <Text style={styles.blockTitle}>Popular searches</Text>

        <View style={styles.chipWrap}>
          {POPULAR.map(term => (
            <TouchableOpacity
              key={term}
              style={styles.chip}
              activeOpacity={0.8}
              onPress={() => applyTerm(term)}>
              <MaterialCommunityIcons
                name="trending-up"
                size={14}
                color={colors.primary}
              />
              <Text style={styles.chipText}>{term}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>
    </View>
  );

  return (
    <View style={styles.screen}>
      <StatusBar
        translucent
        backgroundColor="transparent"
        barStyle="dark-content"
      />

      {/* SEARCH HEADER */}
      <View style={[styles.header, {paddingTop: insets.top + 8}]}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={goBack}
          activeOpacity={0.7}
          hitSlop={{top: 8, bottom: 8, left: 8, right: 8}}>
          <MaterialCommunityIcons
            name="arrow-left"
            size={24}
            color={colors.black}
          />
        </TouchableOpacity>

        <View style={styles.searchBox}>
          <MaterialCommunityIcons name="magnify" size={22} color="#333333" />

          <TextInput
            ref={inputRef}
            style={styles.searchInput}
            placeholder='Search "apple"'
            placeholderTextColor="#888888"
            value={search}
            onChangeText={setSearch}
            onSubmitEditing={() => saveRecent(search)}
            returnKeyType="search"
            autoFocus={!incomingQuery}
            autoCorrect={false}
            autoCapitalize="none"
          />

          {search.length > 0 && (
            <TouchableOpacity
              onPress={() => {
                setSearch('');
                inputRef.current?.focus();
              }}
              activeOpacity={0.7}>
              <MaterialCommunityIcons
                name="close-circle"
                size={20}
                color="#888888"
              />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* BODY */}
      {!isSearching ? (
        renderIdleState()
      ) : (
        <FlatList
          data={results}
          renderItem={renderResult}
          keyExtractor={item => item.id}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{
            paddingHorizontal: 20,
            paddingBottom: cartCount > 0 ? 100 : 24,
          }}
          ListHeaderComponent={
            results.length > 0 ? (
              <Text style={styles.resultsCount}>
                {results.length} result{results.length > 1 ? 's' : ''} for "
                {search.trim()}"
              </Text>
            ) : null
          }
          ListEmptyComponent={
            <View style={styles.emptyWrap}>
              <Text style={styles.emptyEmoji}>🔍</Text>
              <Text style={styles.emptyTitle}>No fruits found</Text>
              <Text style={styles.emptyText}>
                Try a different name, like "apple" or "grapes".
              </Text>
            </View>
          }
        />
      )}

      <CartBar bottom={16} />
    </View>
  );
};

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.background,
  },

  /* HEADER */
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 14,
    paddingBottom: 12,
    elevation: 3,
    shadowColor: '#000000',
    shadowOpacity: 0.08,
    shadowRadius: 6,
    shadowOffset: {width: 0, height: 2},
  },

  backButton: {
    width: 36,
    height: 44,
    alignItems: 'flex-start',
    justifyContent: 'center',
  },

  searchBox: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    height: 46,
    borderRadius: 13,
    paddingHorizontal: 12,
    backgroundColor: '#F3F4F1',
    borderWidth: 1.5,
    borderColor: colors.primary,
  },

  searchInput: {
    flex: 1,
    fontSize: 15,
    color: '#222222',
    marginLeft: 8,
    paddingVertical: 0,
  },

  /* IDLE STATE */
  idleWrap: {
    paddingHorizontal: 20,
    paddingTop: 8,
  },

  block: {
    marginTop: 18,
  },

  blockHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },

  blockTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: colors.black,
  },

  blockAction: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.primary,
  },

  recentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },

  recentText: {
    flex: 1,
    marginLeft: 12,
    marginRight: 8,
    fontSize: 14,
    color: colors.black,
  },

  chipWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 12,
  },

  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginRight: 8,
    marginBottom: 8,
  },

  chipText: {
    marginLeft: 6,
    fontSize: 13,
    fontWeight: '600',
    color: colors.black,
  },

  /* RESULTS */
  resultsCount: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.gray,
    marginTop: 16,
    marginBottom: 6,
  },

  resultRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 10,
    marginTop: 10,
    borderWidth: 1,
    borderColor: colors.border,
  },

  resultImage: {
    width: 68,
    height: 68,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },

  resultEmoji: {
    fontSize: 36,
  },

  resultInfo: {
    flex: 1,
    marginLeft: 12,
    marginRight: 8,
  },

  resultName: {
    fontSize: 14,
    fontWeight: '800',
    color: colors.black,
  },

  resultMeta: {
    fontSize: 11,
    color: colors.gray,
    marginTop: 3,
  },

  resultPriceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 6,
  },

  resultPrice: {
    fontSize: 15,
    fontWeight: '900',
    color: colors.black,
  },

  resultMrp: {
    fontSize: 11,
    color: colors.gray,
    marginLeft: 6,
    textDecorationLine: 'line-through',
  },

  resultOff: {
    marginLeft: 6,
    backgroundColor: colors.primary,
    borderRadius: 5,
    paddingHorizontal: 5,
    paddingVertical: 2,
  },

  resultOffText: {
    color: colors.white,
    fontSize: 9,
    fontWeight: '800',
  },

  /* EMPTY */
  emptyWrap: {
    alignItems: 'center',
    paddingVertical: 48,
  },

  emptyEmoji: {
    fontSize: 44,
  },

  emptyTitle: {
    marginTop: 10,
    fontSize: 16,
    fontWeight: '800',
    color: colors.black,
  },

  emptyText: {
    marginTop: 6,
    fontSize: 13,
    color: colors.gray,
    textAlign: 'center',
  },
});

export default SearchScreen;