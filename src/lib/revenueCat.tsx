import { Platform } from 'react-native';
import { useEffect } from 'react';
import Purchases, { LOG_LEVEL } from 'react-native-purchases';

export function configureRevenueCat() {
  try {
    Purchases.setLogLevel(LOG_LEVEL.VERBOSE);

    // Platform-specific API keys
    const iosApiKey = process.env.EXPO_PUBLIC_REVENUECAT_IOS_KEY;
    const androidApiKey = process.env.EXPO_PUBLIC_REVENUECAT_ANDROID_KEY;

    if (!iosApiKey || !androidApiKey) {
      console.warn('RevenueCat API keys not configured. Premium features will be disabled.');
      return;
    }

    if (Platform.OS === 'ios') {
      Purchases.configure({ apiKey: iosApiKey });
    } else if (Platform.OS === 'android') {
      Purchases.configure({ apiKey: androidApiKey });
    }
  } catch (error) {
    console.error('Failed to configure RevenueCat:', error);
  }
}