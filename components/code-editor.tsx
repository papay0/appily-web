"use client";

import { Editor } from "@monaco-editor/react";
import { useTheme } from "next-themes";

const PLACEHOLDER_CODE = `// Your Expo app code will appear here
import { StatusBar } from 'expo-status-bar';
import { StyleSheet, Text, View } from 'react-native';

export default function App() {
  return (
    <View style={styles.container}>
      <Text>Open up App.js to start working on your app!</Text>
      <StatusBar style="auto" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
`;

export function CodeEditor() {
  const { theme } = useTheme();

  return (
    <div className="h-full w-full">
      <Editor
        height="100%"
        defaultLanguage="javascript"
        defaultValue={PLACEHOLDER_CODE}
        theme={theme === "dark" ? "vs-dark" : "light"}
        options={{
          readOnly: true,
          minimap: { enabled: false },
          fontSize: 14,
          lineNumbers: "on",
          scrollBeyondLastLine: false,
          automaticLayout: true,
        }}
      />
    </div>
  );
}
