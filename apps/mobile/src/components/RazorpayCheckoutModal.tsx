import React from "react";
import { ActivityIndicator, Linking, Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { FontAwesome6 } from "@expo/vector-icons";
import { WebView } from "react-native-webview";

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

export default function RazorpayCheckoutModal({ visible, data, onSuccess, onCancel, onError }: Props): React.JSX.Element | null {
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
      name: data.customerName || "",
      email: data.customerEmail || "",
      contact: data.customerPhone || "",
    },
    config: {
      display: {
        blocks: {
          upi: {
            name: "Pay using UPI",
            instruments: [{ method: "upi" }]
          },
          other: {
            name: "Cards, Netbanking & Wallets",
            instruments: [
              { method: "card" },
              { method: "netbanking" },
              { method: "wallet" }
            ]
          }
        },
        sequence: ["block.upi", "block.other"],
        preferences: {
          show_default_blocks: true
        }
      }
    },
    theme: {
      color: "#1F6A3A",
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
          h3 { margin: 0 0 8px 0; color: #174F2D; }
          p { margin: 0; color: #6D776E; font-size: 14px; }
        </style>
      </head>
      <body>
        <div class="card">
          <div class="spinner"></div>
          <h3>Opening Razorpay Gateway</h3>
          <p>Connecting to secure payment screen...</p>
        </div>
        <script>
          (function() {
            var options = ${JSON.stringify(razorpayOptions)};
            
            options.handler = function(response) {
              if (window.ReactNativeWebView && window.ReactNativeWebView.postMessage) {
                window.ReactNativeWebView.postMessage(JSON.stringify({
                  event: 'SUCCESS',
                  payload: {
                    razorpay_order_id: response.razorpay_order_id,
                    razorpay_payment_id: response.razorpay_payment_id,
                    razorpay_signature: response.razorpay_signature
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
                    error: errObj.description || errObj.reason || 'Payment failed'
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
      const data = JSON.parse(event.nativeEvent.data);
      if (data.event === "SUCCESS" && data.payload) {
        onSuccess(data.payload);
      } else if (data.event === "CANCELLED") {
        onCancel("Payment was cancelled by user.");
      } else if (data.event === "FAILED" || data.event === "ERROR") {
        onError(data.error || "Payment failed or was declined.");
      }
    } catch {
      onError("Failed to parse payment gateway response.");
    }
  };

  const handleShouldStartLoadWithRequest = (request: any) => {
    const url = request.url;
    if (!url) return true;

    // Allow standard HTTP/HTTPS page navigation inside WebView
    if (url.startsWith("http://") || url.startsWith("https://") || url.startsWith("about:blank")) {
      return true;
    }

    // Handle deep links for UPI apps (upi://, intent://, phonepe://, paytm://, gpay://, etc.)
    try {
      void Linking.openURL(url);
    } catch (err) {
      console.warn("Could not launch payment deep link:", url, err);
    }

    return false;
  };

  return (
    <Modal visible={visible} animationType="slide" transparent={false} onRequestClose={() => onCancel("User closed payment window.")}>
      <View style={s.container}>
        <View style={s.header}>
          <View style={s.headerTitleContainer}>
            <FontAwesome6 name="shield-halved" size={18} color="#1F6A3A" />
            <Text style={s.headerTitle}>Razorpay Online Checkout</Text>
          </View>
          <Pressable style={s.closeBtn} onPress={() => onCancel("User closed payment modal.")}>
            <FontAwesome6 name="xmark" size={18} color="#1E271F" />
          </Pressable>
        </View>

        <WebView
          source={{ html: htmlContent, baseUrl: "https://checkout.razorpay.com" }}
          onMessage={handleMessage}
          onShouldStartLoadWithRequest={handleShouldStartLoadWithRequest}
          originWhitelist={["*"]}
          javaScriptEnabled={true}
          domStorageEnabled={true}
          startInLoadingState={true}
          renderLoading={() => (
            <View style={s.loader}>
              <ActivityIndicator size="large" color="#1F6A3A" />
              <Text style={s.loaderText}>Loading Razorpay Gateway...</Text>
            </View>
          )}
          style={{ flex: 1 }}
        />
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
    height: 56,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#E3E9E0",
    backgroundColor: "#FFFFFF",
  },
  headerTitleContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#1E271F",
  },
  closeBtn: {
    padding: 8,
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
});
