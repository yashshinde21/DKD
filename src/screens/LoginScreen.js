
import React, {useState} from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  StatusBar,
  ActivityIndicator,
  Alert,
} from 'react-native';

import colors from '../theme/colors';
import API from '../data/api';

const LoginScreen = ({navigation}) => {
  const [email, setEmail] = useState('');
  const [mode, setMode] = useState('Retail');
  const [focused, setFocused] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const isValidEmail = email => {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
  };

  const handleContinue = async () => {
    setError('');

    if (!email.trim()) {
      setError('Please enter your email address.');
      return;
    }

    if (!isValidEmail(email)) {
      setError('Please enter a valid email address.');
      return;
    }

    try {
      setLoading(true);

      const response = await API.post('/auth/send-otp', {
        email: email.trim().toLowerCase(),
      });

      if (response.data.success) {
        Alert.alert(
          'OTP Sent',
          'A verification code has been sent to your email.',
          [
            {
              text: 'Continue',
              onPress: () => {
                navigation.navigate('OTP', {
                  email: email.trim().toLowerCase(),
                  mode,
                });
              },
            },
          ],
        );
      } else {
        setError(response.data.message || 'Unable to send OTP.');
      }
    } catch (err) {
      console.log(
        'Send OTP Error:',
        err.response?.data || err.message,
      );

      setError(
        err.response?.data?.message ||
          'Unable to send OTP. Please check your internet connection and try again.',
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}>

      <StatusBar
        backgroundColor={colors.primary}
        barStyle="light-content"
      />

      <ScrollView
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        bounces={false}>

        {/* HERO */}
        <View style={styles.hero}>
          <Text style={styles.wordmark}>DKD</Text>

          <Text style={styles.tagline}>
            Fresh fruits. Better living.
          </Text>

          <Text style={styles.since}>
            Trusted Since 1938
          </Text>
        </View>

        {/* LOGIN SHEET */}
        <View style={styles.sheet}>
          <Text style={styles.heading}>
            Log in or sign up
          </Text>

          <Text style={styles.subheading}>
            Enter your email address to continue
          </Text>

          {/* ACCOUNT TYPE */}
          <Text style={styles.label}>
            Account type
          </Text>

          <View style={styles.segment}>
            {['Retail', 'Wholesale'].map(item => {
              const active = mode === item;

              return (
                <TouchableOpacity
                  key={item}
                  style={[
                    styles.segmentItem,
                    active && styles.segmentActive,
                  ]}
                  onPress={() => setMode(item)}
                  activeOpacity={0.85}>

                  <Text
                    style={[
                      styles.segmentText,
                      active && styles.segmentTextActive,
                    ]}>
                    {item}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* EMAIL */}
          <Text style={styles.label}>
            Email address
          </Text>

          <View
            style={[
              styles.emailContainer,
              focused && styles.emailFocused,
              !!error && styles.emailError,
            ]}>

            <TextInput
              style={styles.emailInput}
              placeholder="Enter your email address"
              placeholderTextColor={colors.gray}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              autoComplete="email"
              value={email}
              editable={!loading}
              returnKeyType="done"
              onChangeText={text => {
                setEmail(text);
                if (error) {
                  setError('');
                }
              }}
              onFocus={() => setFocused(true)}
              onBlur={() => setFocused(false)}
              onSubmitEditing={handleContinue}
            />
          </View>

          {!!error && (
            <Text style={styles.errorText}>
              {error}
            </Text>
          )}

          {/* CONTINUE */}
          <TouchableOpacity
            style={[
              styles.continueButton,
              loading && styles.continueLoading,
            ]}
            onPress={handleContinue}
            activeOpacity={0.85}
            disabled={loading}>

            {loading ? (
              <View style={styles.loadingRow}>
                <ActivityIndicator
                  color={colors.white}
                  size="small"
                />
                <Text style={styles.continueText}>
                  Sending OTP...
                </Text>
              </View>
            ) : (
              <Text style={styles.continueText}>
                Continue
              </Text>
            )}
          </TouchableOpacity>

          <Text style={styles.helper}>
            We'll send a one-time password to verify your email.
          </Text>

          {/* TERMS */}
          <Text style={styles.terms}>
            By continuing, you agree to our{' '}
            <Text style={styles.termsBold}>
              Terms & Conditions
            </Text>
            {' '}and{' '}
            <Text style={styles.termsBold}>
              Privacy Policy
            </Text>.
          </Text>

          {/* FOOTER */}
          <Text style={styles.footer}>
            © {new Date().getFullYear()} DKD Fruits & Vegetables Pvt. Ltd.
          </Text>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.primary,
  },

  scroll: {
    flexGrow: 1,
  },

  hero: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: Platform.OS === 'ios' ? 90 : 72,
    paddingBottom: 56,
  },

  wordmark: {
    fontSize: 68,
    fontWeight: '900',
    letterSpacing: 5,
    color: colors.white,
  },

  tagline: {
    marginTop: 8,
    fontSize: 20,
    fontWeight: '700',
    color: '#F5D66D',
  },

  since: {
    marginTop: 12,
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 2,
    textTransform: 'uppercase',
    color: colors.white,
    opacity: 0.85,
  },

  sheet: {
    flexGrow: 1,
    backgroundColor: colors.white,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: 22,
    paddingTop: 28,
    paddingBottom: 20,
  },

  heading: {
    fontSize: 24,
    fontWeight: '800',
    color: colors.black,
  },

  subheading: {
    marginTop: 6,
    fontSize: 14,
    color: colors.gray,
  },

  label: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.text,
    marginTop: 22,
    marginBottom: 8,
  },

  segment: {
    flexDirection: 'row',
    backgroundColor: colors.background,
    borderRadius: 12,
    padding: 3,
    borderWidth: 1,
    borderColor: colors.border,
  },

  segmentItem: {
    flex: 1,
    paddingVertical: 11,
    borderRadius: 10,
    alignItems: 'center',
  },

  segmentActive: {
    backgroundColor: colors.primary,
  },

  segmentText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.gray,
  },

  segmentTextActive: {
    color: colors.white,
    fontWeight: '700',
  },

  emailContainer: {
    height: 54,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    paddingHorizontal: 16,
    backgroundColor: colors.white,
  },

  emailFocused: {
    borderColor: colors.primary,
    borderWidth: 1.5,
  },

  emailError: {
    borderColor: '#D64545',
  },

  emailInput: {
    flex: 1,
    height: 54,
    fontSize: 15,
    color: colors.black,
  },

  errorText: {
    marginTop: 6,
    marginLeft: 4,
    fontSize: 12,
    color: '#D64545',
  },

  continueButton: {
    height: 54,
    backgroundColor: colors.primary,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 24,
  },

  continueLoading: {
    opacity: 0.8,
  },

  continueText: {
    color: colors.white,
    fontSize: 16,
    fontWeight: '800',
  },

  loadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },

  helper: {
    marginTop: 14,
    textAlign: 'center',
    fontSize: 12,
    color: colors.gray,
  },

  terms: {
    marginTop: 'auto',
    paddingTop: 28,
    textAlign: 'center',
    fontSize: 11,
    lineHeight: 17,
    color: colors.gray,
  },

  termsBold: {
    color: colors.text,
    fontWeight: '700',
  },

  footer: {
    marginTop: 12,
    textAlign: 'center',
    fontSize: 11,
    color: colors.gray,
  },
});

export default LoginScreen;
