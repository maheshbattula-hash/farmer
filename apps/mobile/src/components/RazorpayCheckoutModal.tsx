import React, { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Linking,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import * as RN from "react-native";
import { FontAwesome6 } from "@expo/vector-icons";
import { WebView } from "react-native-webview";

const AppState = (RN as any).AppState || {
  currentState: "active",
  addEventListener: () => ({ remove: () => {} }),
};

export type RazorpayCheckoutData = {
  keyId: string;
  razorpayOrderId: string;
  amountPaise: number;
  amount: number;
  currency: string;
  orderId: string;
  customerName?: string;
  customerEmail?: string;
  customerPhone?: string;
  cropName?: string;
};

export type RazorpaySuccessPayload = {
  razorpay_order_id: string;
  razorpay_payment_id: string;
  razorpay_signature: string;
};

type Props = {
  visible: boolean;
  data: RazorpayCheckoutData | null;
  onSuccess: (payload: RazorpaySuccessPayload) => void;
  onCancel: (reason?: string) => void;
  onError: (errorMessage: string) => void;
};

type UpiAppInfo = {
  id: string;
  name: string;
  scheme: string;
  icon: string;
  color: string;
  installed: boolean;
};

const POPULAR_UPI_APPS: Omit<UpiAppInfo, "installed">[] = [
  { id: "phonepe", name: "PhonePe", scheme: "phonepe://pay", icon: "mobile-screen-button", color: "#5F259F" },
  { id: "gpay", name: "Google Pay", scheme: "tez://upi/pay", icon: "google", color: "#4285F4" },
  { id: "paytm", name: "Paytm", scheme: "paytmmp://pay", icon: "wallet", color: "#00BAF2" },
  { id: "bhim", name: "BHIM", scheme: "bhim://pay", icon: "building-columns", color: "#00796B" },
];

export default function RazorpayCheckoutModal({
  visible,
  data,
  onSuccess,
  onCancel,
  onError,
}: Props): React.JSX.Element | null {
  const [upiApps, setUpiApps] = useState<UpiAppInfo[]>(
    POPULAR_UPI_APPS.map((app) => ({ ...app, installed: false }))
  );
  const [verifyingUpi, setVerifyingUpi] = useState(false);
  const upiIntentLaunchedRef = useRef(false);
  const appStateRef = useRef(AppState.currentState);

  // Detect installed UPI apps on Android
  useEffect(() => {
    if (!visible) return;

    let isMounted = true;
    (async () => {
      const checkedApps: UpiAppInfo[] = await Promise.all(
        POPULAR_UPI_APPS.map(async (app) => {
          let installed = false;
          try {
            installed = await Linking.canOpenURL(app.scheme);
          } catch (_) {
            installed = false;
          }
          return { ...app, installed };
        })
      );
      if (isMounted) {
        setUpiApps(checkedApps);
      }
    })();

    return () => {
      isMounted = false;
    };
  }, [visible]);

  // Listen for app return from external UPI apps (PhonePe, Google Pay, Paytm, BHIM)
  useEffect(() => {
    if (!visible) {
      upiIntentLaunchedRef.current = false;
      setVerifyingUpi(false);
      return;
    }

    const subscription = AppState.addEventListener("change", (nextAppState) => {
      if (appStateRef.current.match(/inactive|background/) && nextAppState === "active") {
        if (upiIntentLaunchedRef.current && data) {
          console.log("[PAYMENT DEBUG] User returned to app after launching UPI Intent. Initiating verification...");
          setVerifyingUpi(true);
          onSuccess({
            razorpay_order_id: data.razorpayOrderId,
            razorpay_payment_id: "",
            razorpay_signature: "",
          });
        }
      }
      appStateRef.current = nextAppState;
    });

    return () => {
      subscription.remove();
    };
  }, [visible, data, onSuccess]);

  if (!visible || !data) {
    return null;
  }

  const razorpayOptions = {
    key: data.keyId,
    amount: data.amountPaise || Math.round(data.amount * 100),
    currency: data.currency || "INR",
    name: "Smart Farmer Market",
    description: `Payment for ${data.cropName || "Crop Order"}`,
    order_id: data.razorpayOrderId,
    prefill: {
      method: "upi",
      name: data.customerName || "",
      email: data.customerEmail || "",
      contact: data.customerPhone || "",
    },
    theme: {
      color: "#1F6A3A",
    },
    config: {
      display: {
        blocks: {
          upi: {
            name: "Pay using UPI (PhonePe / GPay / Paytm / BHIM)",
            instruments: [
              {
                method: "upi",
              },
            ],
          },
          other: {
            name: "Cards, Netbanking & Wallets",
            instruments: [
              { method: "card" },
              { method: "netbanking" },
              { method: "wallet" },
            ],
          },
        },
        sequence: ["block.upi", "block.other"],
        preferences: {
          show_default_blocks: true,
        },
      },
    },
  };

  const htmlContent = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
        <title>Razorpay Checkout</title>
        <script src="https://checkout.razorpay.com/v1/checkout.js"></script>
        <style>
          body {
            background-color: #F7F5EE;
            color: #1E271F;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            height: 100vh;
            margin: 0;
            padding: 20px;
            box-sizing: border-box;
          }
          .card {
            background: #ffffff;
            padding: 24px;
            border-radius: 16px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.08);
            text-align: center;
            max-width: 320px;
            width: 100%;
          }
          .spinner {
            border: 4px solid #E7F3E6;
            border-top: 4px solid #1F6A3A;
            border-radius: 50%;
            width: 36px;
            height: 36px;
            animation: spin 1s linear infinite;
            margin: 0 auto 16px auto;
          }
          @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }
          h3 { margin: 0 0 8px 0; color: #174F2D; font-size: 16px; }
          p { margin: 0; color: #6D776E; font-size: 13px; }
        </style>
      </head>
      <body>
        <div class="card">
          <div class="spinner"></div>
          <h3>Connecting to Razorpay Gateway</h3>
          <p>Opening secure payment window with UPI, Cards & Netbanking...</p>
        </div>
        <script>
          (function() {
            var options = ${JSON.stringify(razorpayOptions)};
            
            options.handler = function(response) {
              if (window.ReactNativeWebView && window.ReactNativeWebView.postMessage) {
                window.ReactNativeWebView.postMessage(JSON.stringify({
                  event: 'SUCCESS',
                  payload: {
                    razorpay_order_id: response.razorpay_order_id || '${data.razorpayOrderId}',
                    razorpay_payment_id: response.razorpay_payment_id,
                    razorpay_signature: response.razorpay_signature || ''
                  }
                }));
              }
            };
            
            options.modal = {
              ondismiss: function() {
                if (window.ReactNativeWebView && window.ReactNativeWebView.postMessage) {
                  window.ReactNativeWebView.postMessage(JSON.stringify({
                    event: 'CANCELLED'
                  }));
                }
              }
            };
            
            try {
              var rzp = new Razorpay(options);
              rzp.on('payment.failed', function(response) {
                var errObj = response && response.error ? response.error : {};
                if (window.ReactNativeWebView && window.ReactNativeWebView.postMessage) {
                  window.ReactNativeWebView.postMessage(JSON.stringify({
                    event: 'FAILED',
                    error: errObj.description || errObj.reason || 'Payment was declined or cancelled.'
                  }));
                }
              });
              
              window.onload = function() {
                rzp.open();
              };
            } catch(e) {
              if (window.ReactNativeWebView && window.ReactNativeWebView.postMessage) {
                window.ReactNativeWebView.postMessage(JSON.stringify({
                  event: 'ERROR',
                  error: e.message || 'Razorpay checkout initialization failed'
                }));
              }
            }
          })();
        </script>
      </body>
    </html>
  `;

  const handleMessage = (event: any) => {
    try {
      const msgData = JSON.parse(event.nativeEvent.data);
      if (msgData.event === "SUCCESS" && msgData.payload) {
        onSuccess(msgData.payload);
      } else if (msgData.event === "CANCELLED") {
        onCancel("Payment window was dismissed.");
      } else if (msgData.event === "FAILED" || msgData.event === "ERROR") {
        onError(msgData.error || "Payment was not completed.");
      }
    } catch {
      onError("Failed to parse payment gateway response.");
    }
  };

  const launchPaymentIntentUrl = async (url: string) => {
    try {
      console.log("[PAYMENT DEBUG] Intercepted payment deep link / intent:", url);

      // Handle Android intent URLs
      if (url.startsWith("intent:") || url.startsWith("intent://")) {
        // Try opening directly first
        try {
          const can = await Linking.canOpenURL(url);
          if (can) {
            await Linking.openURL(url);
            return;
          }
        } catch (_) {}

        // Parse intent scheme components
        let upiUri = "";
        const dataMatch = url.match(/data=([^;]+)/);
        if (dataMatch && dataMatch[1]) {
          upiUri = decodeURIComponent(dataMatch[1]);
        } else {
          const schemeMatch = url.match(/scheme=([^;]+)/);
          const scheme = schemeMatch ? schemeMatch[1] : "upi";
          const pathAndQuery = url.replace(/^intent:\/\//, "").replace(/^intent:/, "").split("#Intent")[0];
          upiUri = `${scheme}://${pathAndQuery}`;
        }

        const pkgMatch = url.match(/package=([^;]+)/);
        const pkg = pkgMatch ? pkgMatch[1].toLowerCase() : "";

        // Route to specific app scheme if package is recognized
        if (pkg.includes("phonepe") && upiUri.startsWith("upi://")) {
          const phonepeUri = upiUri.replace(/^upi:\/\//, "phonepe://");
          try {
            if (await Linking.canOpenURL(phonepeUri)) {
              await Linking.openURL(phonepeUri);
              return;
            }
          } catch (_) {}
        } else if ((pkg.includes("paisa") || pkg.includes("google")) && upiUri.startsWith("upi://")) {
          const gpayUri = upiUri.replace(/^upi:\/\//, "tez://upi/");
          try {
            if (await Linking.canOpenURL(gpayUri)) {
              await Linking.openURL(gpayUri);
              return;
            }
          } catch (_) {}
        } else if (pkg.includes("paytm") && upiUri.startsWith("upi://")) {
          const paytmUri = upiUri.replace(/^upi:\/\//, "paytmmp://");
          try {
            if (await Linking.canOpenURL(paytmUri)) {
              await Linking.openURL(paytmUri);
              return;
            }
          } catch (_) {}
        } else if ((pkg.includes("bhim") || pkg.includes("npci")) && upiUri.startsWith("upi://")) {
          const bhimUri = upiUri.replace(/^upi:\/\//, "bhim://");
          try {
            if (await Linking.canOpenURL(bhimUri)) {
              await Linking.openURL(bhimUri);
              return;
            }
          } catch (_) {}
        }

        // Try launching upiUri directly
        if (upiUri) {
          try {
            await Linking.openURL(upiUri);
            return;
          } catch (err) {
            console.warn("[PAYMENT DEBUG] upiUri launch failed:", upiUri, err);
          }
        }

        // Fallback: raw upi:// with original path
        const rawPath = url.replace(/^intent:\/\//, "").replace(/^intent:/, "").split("#Intent")[0];
        try {
          await Linking.openURL(`upi://${rawPath}`);
        } catch (rawErr) {
          console.warn("[PAYMENT DEBUG] Fallback raw upi:// failed:", rawErr);
        }
        return;
      }

      // Handle direct app schemes (upi://, phonepe://, tez://, paytmmp://, bhim://, cred://)
      try {
        await Linking.openURL(url);
      } catch (err) {
        console.warn("[PAYMENT DEBUG] Could not open direct scheme URL:", url, err);
        if (!url.startsWith("upi://")) {
          const generic = url.replace(/^[a-z0-9_-]+:\/\/(upi\/)?/, "upi://");
          try {
            await Linking.openURL(generic);
          } catch (_) {}
        }
      }
    } catch (globalErr) {
      console.warn("[PAYMENT DEBUG] Error in launchPaymentIntentUrl:", globalErr);
    }
  };

  const handleShouldStartLoadWithRequest = (request: any) => {
    const url = request.url;
    if (!url) return true;

    // 1. Check if redirect contains successful payment parameters
    if (url.includes("razorpay_payment_id=") || url.includes("payment_id=")) {
      try {
        const parsed = new URL(url);
        const paymentId = parsed.searchParams.get("razorpay_payment_id") || parsed.searchParams.get("payment_id") || "";
        const orderId = parsed.searchParams.get("razorpay_order_id") || data.razorpayOrderId;
        const signature = parsed.searchParams.get("razorpay_signature") || "";
        if (paymentId) {
          onSuccess({
            razorpay_order_id: orderId,
            razorpay_payment_id: paymentId,
            razorpay_signature: signature,
          });
          return false;
        }
      } catch (_) {}
    }

    // 2. Allow standard HTTP/HTTPS page navigation inside WebView
    if (url.startsWith("http://") || url.startsWith("https://") || url.startsWith("about:blank")) {
      return true;
    }

    // 3. Handle UPI Intent or custom URL schemes
    upiIntentLaunchedRef.current = true;
    void launchPaymentIntentUrl(url);
    return false;
  };

  return (
    <Modal visible={visible} animationType="slide" transparent={false} onRequestClose={() => onCancel("User closed payment window.")}>
      <View style={s.container}>
        {/* Top Header */}
        <View style={s.header}>
          <View style={s.headerTitleContainer}>
            <FontAwesome6 name="shield-halved" size={18} color="#1F6A3A" />
            <View>
              <Text style={s.headerTitle}>Razorpay Online Checkout</Text>
              <Text style={s.headerSubtitle}>₹{(data.amountPaise / 100 || data.amount).toFixed(2)} · Order #{data.orderId.slice(-6).toUpperCase()}</Text>
            </View>
          </View>
          <Pressable style={s.closeBtn} onPress={() => onCancel("User closed payment modal.")}>
            <FontAwesome6 name="xmark" size={18} color="#1E271F" />
          </Pressable>
        </View>

        {/* UPI Apps Detection Strip */}
        <View style={s.upiStrip}>
          <View style={s.upiStripTop}>
            <FontAwesome6 name="bolt" size={13} color="#1F6A3A" />
            <Text style={s.upiStripTitle}>UPI Supported Apps</Text>
            <Text style={s.upiStripHint}>Tap UPI in checkout to open</Text>
          </View>
          <View style={s.upiAppsList}>
            {upiApps.map((app) => (
              <View key={app.id} style={s.upiAppChip}>
                <FontAwesome6 name={app.icon as any} size={12} color={app.color} />
                <Text style={s.upiAppText}>{app.name}</Text>
                {app.installed ? (
                  <View style={s.installedBadge}>
                    <Text style={s.installedText}>Ready</Text>
                  </View>
                ) : null}
              </View>
            ))}
          </View>
        </View>

        {/* Razorpay Gateway WebView */}
        <View style={{ flex: 1 }}>
          <WebView
            source={{ html: htmlContent, baseUrl: "https://checkout.razorpay.com" }}
            userAgent="Mozilla/5.0 (Linux; Android 14; Mobile) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Mobile Safari/537.36"
            onMessage={handleMessage}
            onShouldStartLoadWithRequest={handleShouldStartLoadWithRequest}
            setSupportMultipleWindows={false}
            thirdPartyCookiesEnabled={true}
            sharedCookiesEnabled={true}
            domStorageEnabled={true}
            javaScriptEnabled={true}
            mixedContentMode="always"
            javaScriptCanOpenWindowsAutomatically={true}
            originWhitelist={["*"]}
            startInLoadingState={true}
            renderLoading={() => (
              <View style={s.loader}>
                <ActivityIndicator size="large" color="#1F6A3A" />
                <Text style={s.loaderText}>Loading Razorpay Secure Gateway...</Text>
              </View>
            )}
            style={{ flex: 1 }}
          />

          {/* Active Verification Overlay when user returns from UPI app */}
          {verifyingUpi && (
            <View style={s.verifyingOverlay}>
              <View style={s.verifyingBox}>
                <ActivityIndicator size="large" color="#1F6A3A" />
                <Text style={s.verifyingTitle}>Verifying Payment...</Text>
                <Text style={s.verifyingSub}>Checking transaction with your bank and Razorpay gateway. Please wait a moment.</Text>
              </View>
            </View>
          )}
        </View>

        {/* Bottom Bar */}
        <View style={s.bottomBar}>
          <View style={s.bottomTextCol}>
            <Text style={s.bottomNote}>Paid via UPI or Bank App?</Text>
            <Text style={s.bottomSub}>Tap to confirm instantly</Text>
          </View>
          <Pressable
            style={s.verifyBtn}
            onPress={() => {
              setVerifyingUpi(true);
              onSuccess({
                razorpay_order_id: data.razorpayOrderId,
                razorpay_payment_id: "",
                razorpay_signature: "",
              });
            }}
          >
            <FontAwesome6 name="circle-check" size={15} color="#fff" />
            <Text style={s.verifyBtnText}>Verify Payment</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F7F5EE",
  },
  header: {
    minHeight: 56,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#E3E9E0",
    backgroundColor: "#FFFFFF",
  },
  headerTitleContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    flex: 1,
  },
  headerTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: "#1E271F",
  },
  headerSubtitle: {
    fontSize: 12,
    color: "#5C6B5E",
    fontWeight: "500",
  },
  closeBtn: {
    padding: 8,
    borderRadius: 8,
    backgroundColor: "#F2F5F0",
  },
  upiStrip: {
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#E9EFE6",
  },
  upiStripTop: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 6,
  },
  upiStripTitle: {
    fontSize: 12,
    fontWeight: "700",
    color: "#174F2D",
  },
  upiStripHint: {
    fontSize: 11,
    color: "#778578",
    marginLeft: "auto",
  },
  upiAppsList: {
    flexDirection: "row",
    gap: 8,
    flexWrap: "wrap",
  },
  upiAppChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: "#F4F7F2",
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: "#E2EAE0",
  },
  upiAppText: {
    fontSize: 11,
    fontWeight: "600",
    color: "#2C392E",
  },
  installedBadge: {
    backgroundColor: "#E2F4E6",
    borderRadius: 4,
    paddingHorizontal: 4,
    paddingVertical: 1,
  },
  installedText: {
    fontSize: 9,
    fontWeight: "700",
    color: "#1B6334",
  },
  loader: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "#F7F5EE",
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
  },
  loaderText: {
    fontSize: 14,
    color: "#6D776E",
    fontWeight: "600",
  },
  verifyingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(247, 245, 238, 0.92)",
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  verifyingBox: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 24,
    alignItems: "center",
    gap: 10,
    width: "100%",
    maxWidth: 320,
    shadowColor: "#000",
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 4,
    borderWidth: 1,
    borderColor: "#E3ECE1",
  },
  verifyingTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#174F2D",
    marginTop: 4,
  },
  verifyingSub: {
    fontSize: 13,
    color: "#606D61",
    textAlign: "center",
    lineHeight: 18,
  },
  bottomBar: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: "#FFFFFF",
    borderTopWidth: 1,
    borderTopColor: "#E3E9E0",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  bottomTextCol: {
    flex: 1,
  },
  bottomNote: {
    fontSize: 13,
    color: "#1E271F",
    fontWeight: "600",
  },
  bottomSub: {
    fontSize: 11,
    color: "#758276",
  },
  verifyBtn: {
    backgroundColor: "#1F6A3A",
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 10,
  },
  verifyBtnText: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "700",
  },
});
