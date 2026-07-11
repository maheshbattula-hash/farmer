declare namespace React {
  type SetStateAction<S> = S | ((prevState: S) => S);
  type Dispatch<A> = (value: A) => void;
  type ReactNode = any;
  type ComponentProps<T> = any;
  namespace JSX {
    interface Element {}
    interface IntrinsicElements {
      [elemName: string]: any;
    }
  }
}

declare module 'react' {
  export = React;
  export as namespace React;

  export function useEffect(effect: () => void | (() => void), deps?: readonly any[]): void;
  export function useMemo<T>(factory: () => T, deps: readonly any[]): T;
  export function useRef<T>(initialValue: T): { current: T };
  export function useState<S>(initialState: S | (() => S)): [S, React.Dispatch<React.SetStateAction<S>>];
}

declare module 'react/jsx-runtime' {
  export const Fragment: any;
  export function jsx(type: any, props: any, key?: any): any;
  export function jsxs(type: any, props: any, key?: any): any;
}

declare module 'react-native' {
  export const ActivityIndicator: any;
  export const Animated: any;
  export const Easing: any;
  export const Alert: any;
  export const Image: any;
  export const ImageBackground: any;
  export const KeyboardAvoidingView: any;
  export const Modal: any;
  export const Platform: { OS?: string; select(config: Record<string, any>): any };
  export const Pressable: any;
  export const ScrollView: any;
  export const StatusBar: any;
  export const Text: any;
  export const TextInput: any;
  export const View: any;
  export const Linking: { openURL(url: string): void | Promise<void> };
  export function useColorScheme(): 'light' | 'dark' | null;
  export const StyleSheet: {
    absoluteFillObject: Record<string, any>;
    create<T extends Record<string, any>>(styles: T): T;
  };
}

declare module '@expo/vector-icons' {
  export const Feather: any;
  export const FontAwesome6: any;
  export const MaterialCommunityIcons: any;
}

declare module 'react-native-safe-area-context' {
  export const SafeAreaProvider: any;
  export const SafeAreaView: any;
}

declare module 'expo-constants' {
  const Constants: {
    expoConfig?: Record<string, any> | null;
    expoGoConfig?: Record<string, any> | null;
    platform?: Record<string, any> | null;
  };
  export default Constants;
}

declare module '*.png' {
  const value: any;
  export default value;
}

declare const process: {
  env: Record<string, string | undefined>;
};

declare function require(path: string): any;
