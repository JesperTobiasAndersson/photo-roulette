import React from "react";
import { Linking, Platform, Text, View } from "react-native";
import { useI18n } from "../src/lib/i18n";
import { showAlert } from "../src/lib/notify";
import { WebSeo } from "../src/components/WebSeo";
import { Button, Screen, TopBar } from "../src/ui/components";
import { colors, space, type } from "../src/ui/theme";

const SUPPORT_EMAIL = "support@picklo.app";
const PRIVACY_EMAIL = "privacy@picklo.app";

function openMail(address: string, fallbackTitle: string) {
  const url = `mailto:${address}`;
  if (Platform.OS === "web" && typeof window !== "undefined") {
    // Navigating directly hands off to the mail app without opening an empty tab.
    window.location.href = url;
    return;
  }
  Linking.openURL(url).catch(() => showAlert(fallbackTitle, address));
}

export default function ContactScreen() {
  const { language } = useI18n();
  const copy =
    language === "sv"
      ? {
          title: "Kontakt",
          intro: "Kontakta Picklo för support, integritetsärenden, modereringsfrågor eller juridiska meddelanden med uppgifterna nedan.",
          supportTitle: "Supportmejl",
          supportBody: "Använd detta för spelproblem, buggrapporter, rapporter om olämpligt innehåll och allmän support.",
          supportButton: "Mejla support",
          privacyTitle: "Integritets- eller dataärenden",
          privacyBody: "Använd detta för åtkomst, rättelse, radering och integritetsfrågor. Inkludera tillräckligt med detaljer för att vi ska kunna identifiera relevant session eller begäran.",
          privacyButton: "Mejla om integritet",
          responseTitle: "Svarstider",
          responseBody: "Vi siktar på att svara inom rimlig tid. För juridiska eller integritetsrelaterade ärenden kan ytterligare verifiering krävas innan vi behandlar vissa förfrågningar.",
          noMailApp: "Ingen mejlapp hittades. Skriv till:",
        }
      : {
          title: "Contact",
          intro: "Contact Picklo for support, privacy requests, moderation issues, or legal notices using the details below.",
          supportTitle: "Support email",
          supportBody: "Use this for gameplay problems, bug reports, reports of inappropriate content, and general support.",
          supportButton: "Email support",
          privacyTitle: "Privacy or data requests",
          privacyBody: "Use this for access, correction, deletion, and privacy-related questions. Include enough detail for us to identify the relevant session or request.",
          privacyButton: "Email privacy team",
          responseTitle: "Response expectations",
          responseBody: "We aim to respond within a reasonable time. For legal or privacy matters, additional verification may be required before we process certain requests.",
          noMailApp: "No mail app found. Write to:",
        };

  return (
    <Screen
      topBar={<TopBar backHref="/" />}
      footer={<Button label={copy.supportButton} icon="mail" onPress={() => openMail(SUPPORT_EMAIL, copy.noMailApp)} />}
    >
      <WebSeo title={`${copy.title} | Picklo`} description={copy.intro} lang={language} path="/contact" />

      <View style={{ gap: space.sm }}>
        <Text accessibilityRole="header" style={[type.title, { color: colors.text }]}>
          {copy.title}
        </Text>
        <Text style={{ color: colors.textMuted, fontSize: 15, lineHeight: 23 }}>{copy.intro}</Text>
      </View>

      <ContactSection title={copy.supportTitle} email={SUPPORT_EMAIL} body={copy.supportBody} />

      <ContactSection title={copy.privacyTitle} email={PRIVACY_EMAIL} body={copy.privacyBody}>
        <Button
          label={copy.privacyButton}
          icon="shield-checkmark"
          variant="secondary"
          size="md"
          onPress={() => openMail(PRIVACY_EMAIL, copy.noMailApp)}
        />
      </ContactSection>

      <ContactSection title={copy.responseTitle} body={copy.responseBody} />
    </Screen>
  );
}

function ContactSection({ title, email, body, children }: { title: string; email?: string; body: string; children?: React.ReactNode }) {
  return (
    <View style={{ gap: space.sm, borderTopWidth: 1, borderTopColor: colors.border, paddingTop: space.lg }}>
      <Text accessibilityRole="header" style={[type.heading, { color: colors.text }]}>
        {title}
      </Text>
      {email ? (
        <Text selectable style={{ color: colors.brand, fontSize: 16, fontWeight: "700" }}>
          {email}
        </Text>
      ) : null}
      <Text style={{ color: colors.textSecondary, fontSize: 16, lineHeight: 25 }}>{body}</Text>
      {children}
    </View>
  );
}
