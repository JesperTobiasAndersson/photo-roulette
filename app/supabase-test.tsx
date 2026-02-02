import { View, Text, Button } from "react-native";
import { useState } from "react";
import { supabase } from "../src/lib/supabase";

export default function SupabaseTest() {
  const [result, setResult] = useState<string>("");

  const ping = async () => {
    const { data, error } = await supabase.from("rooms").select("id").limit(1);
    if (error) setResult("Error: " + error.message);
    else setResult("OK ✅ (rooms rows fetched: " + (data?.length ?? 0) + ")");
  };

  return (
    <View style={{ flex: 1, padding: 20, justifyContent: "center", gap: 12 }}>
      <Text style={{ fontSize: 22, fontWeight: "700" }}>Supabase test</Text>
      <Button title="Ping rooms table" onPress={ping} />
      <Text>{result}</Text>
    </View>
  );
}
