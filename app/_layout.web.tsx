import { useEffect } from "react";
import { Text, TextInput } from "react-native";
import { RootLayoutShell } from "../src/components/RootLayoutShell";

const appFontFamily = '"Roboto Slab", serif';

function configureGlobalTypography() {
  const TextComponent = Text as typeof Text & { defaultProps?: { style?: unknown } };
  TextComponent.defaultProps = TextComponent.defaultProps ?? {};
  TextComponent.defaultProps.style = [{ fontFamily: appFontFamily }, TextComponent.defaultProps.style];

  const TextInputComponent = TextInput as typeof TextInput & { defaultProps?: { style?: unknown } };
  TextInputComponent.defaultProps = TextInputComponent.defaultProps ?? {};
  TextInputComponent.defaultProps.style = [
    { fontFamily: appFontFamily },
    TextInputComponent.defaultProps.style,
  ];
}

export default function Layout() {
  useEffect(() => {
    configureGlobalTypography();

    const linkId = "picklo-roboto-slab-font";
    const existingLink = document.getElementById(linkId);

    if (!existingLink) {
      const link = document.createElement("link");
      link.id = linkId;
      link.rel = "stylesheet";
      link.href =
        "https://fonts.googleapis.com/css2?family=Roboto+Slab:wght@100..900&display=swap";
      document.head.appendChild(link);
    }

    document.documentElement.style.fontFamily = appFontFamily;
    document.body.style.fontFamily = appFontFamily;
  }, []);

  return <RootLayoutShell />;
}
