import { Redirect, useLocalSearchParams } from "expo-router";

// Legacy invite links (/join?code=XXXX) now open the MemeMatch entry screen with the code filled in.
export default function JoinRedirect() {
  const { code } = useLocalSearchParams<{ code?: string }>();
  return <Redirect href={code ? { pathname: "/picklo", params: { code } } : "/picklo"} />;
}
