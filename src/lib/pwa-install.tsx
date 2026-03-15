import React, { useState, useEffect } from 'react';
import { View, Text, Pressable, Platform } from 'react-native';

// Extend the global WindowEventMap to include beforeinstallprompt
declare global {
  interface WindowEventMap {
    beforeinstallprompt: BeforeInstallPromptEvent;
  }
}

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

interface PWAInstallProps {
  children?: React.ReactNode;
}

export const PWAInstall: React.FC<PWAInstallProps> = ({ children }) => {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [showInstall, setShowInstall] = useState(false);
  const isWeb = Platform.OS === 'web';

  useEffect(() => {
    if (!isWeb || typeof window === 'undefined') return;

    const handleBeforeInstallPrompt = (e: BeforeInstallPromptEvent) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setShowInstall(true);
    };

    const handleAppInstalled = () => {
      setShowInstall(false);
      setDeferredPrompt(null);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, [isWeb]);

  const handleInstall = async () => {
    if (!deferredPrompt) return;

    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;

    if (outcome === 'accepted') {
      setShowInstall(false);
    }

    setDeferredPrompt(null);
  };

  const handleDismiss = () => {
    setShowInstall(false);
  };

  if (!isWeb || !showInstall) {
    return <>{children}</>;
  }

  return (
    <>
      {children}
      <View
        style={{
          position: (isWeb ? 'fixed' : 'absolute') as any,
          bottom: 20,
          left: 20,
          right: 20,
          backgroundColor: '#1F2937',
          borderRadius: 12,
          padding: 16,
          borderWidth: 1,
          borderColor: '#374151',
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: 0.3,
          shadowRadius: 8,
          elevation: 10,
          zIndex: 1000,
        }}
      >
        <Text
          style={{
            color: '#F9FAFB',
            fontSize: 16,
            fontWeight: '700',
            marginBottom: 8,
            textAlign: 'center',
          }}
        >
          📱 Install Picklo App
        </Text>
        <Text
          style={{
            color: '#D1D5DB',
            fontSize: 14,
            marginBottom: 16,
            textAlign: 'center',
            lineHeight: 20,
          }}
        >
          Get the full app experience with offline access and home screen icon!
        </Text>
        <View style={{ flexDirection: 'row', gap: 12 }}>
          <Pressable
            onPress={handleInstall}
            style={{
              flex: 1,
              backgroundColor: '#7C5CFF',
              borderRadius: 8,
              paddingVertical: 12,
              alignItems: 'center',
            }}
          >
            <Text style={{ color: '#FFFFFF', fontWeight: '700', fontSize: 14 }}>
              Install App
            </Text>
          </Pressable>
          <Pressable
            onPress={handleDismiss}
            style={{
              flex: 1,
              backgroundColor: '#374151',
              borderRadius: 8,
              paddingVertical: 12,
              alignItems: 'center',
            }}
          >
            <Text style={{ color: '#D1D5DB', fontWeight: '600', fontSize: 14 }}>
              Maybe Later
            </Text>
          </Pressable>
        </View>
      </View>
    </>
  );
};
