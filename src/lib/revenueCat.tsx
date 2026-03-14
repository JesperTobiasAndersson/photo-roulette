import { Platform } from 'react-native';
import { useEffect } from 'react';

// For web, use the web SDK
let Purchases: any;
if (Platform.OS === 'web') {
  Purchases = require('@revenuecat/purchases-js').default;
} else {
  Purchases = require('react-native-purchases').default;
}

export function configureRevenueCat() {
  try {
    Purchases.setLogLevel(Purchases.LOG_LEVEL.VERBOSE);

    // Platform-specific API keys
    const iosApiKey = process.env.EXPO_PUBLIC_REVENUECAT_IOS_KEY;
    const androidApiKey = process.env.EXPO_PUBLIC_REVENUECAT_ANDROID_KEY;
    const webApiKey = process.env.EXPO_PUBLIC_REVENUECAT_WEB_KEY || iosApiKey; // Use same or separate

    if (!iosApiKey || !androidApiKey) {
      console.warn('RevenueCat API keys not configured. Premium features will be disabled.');
      return;
    }

    if (Platform.OS === 'ios') {
      Purchases.configure({ apiKey: iosApiKey });
    } else if (Platform.OS === 'android') {
      Purchases.configure({ apiKey: androidApiKey });
    } else if (Platform.OS === 'web') {
      Purchases.configure({ apiKey: webApiKey });
    }
  } catch (error) {
    console.error('Failed to configure RevenueCat:', error);
  }
}