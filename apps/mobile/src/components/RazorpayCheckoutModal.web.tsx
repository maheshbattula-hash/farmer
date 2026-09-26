/**
 * RazorpayCheckoutModal — Web shim
 *
 * react-native-webview has no web support, so this file is loaded instead
 * of RazorpayCheckoutModal.tsx when the app runs in a browser.
 *
 * It opens the Razorpay checkout.js SDK directly in the browser window
 * via a dynamically injected <script> tag, which is the standard web
 * integration approach for Razorpay.
 */
import React, { useEffect, useRef } from "react";
import { Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { FontAwesome6 } from "@expo/vector-icons";

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

/** Load the Razorpay checkout.js script once into the browser page. */
function ensureRazorpayScript(): Promise<void> {
  return new Promise((resolve, reject) => {
    if ((window as any).Razorpay) { resolve(); return; }
    const existing = document.getElementById("rzp-checkout-js");
    if (existing) {
      existing.addEventListener("load", () => resolve());
      existing.addEventListener("error", reject);
      return;
    }
    const script = document.createElement("script");
    script.id = "rzp-checkout-js";
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.async = true;
    script.onload = () => resolve();
    script.onerror = reject;
    document.head.appendChild(script);
  });
}

export default function RazorpayCheckoutModal({
  visible,
  data,
  onSuccess,
  onCancel,
  onError,
}: Props): React.JSX.Element | null {
  const rzpRef = useRef<any>(null);

  useEffect(() => {
    if (!visible || !data) return;

    let cancelled = false;

    (async () => {
      try {
        await ensureRazorpayScript();
        if (cancelled) return;

        const options = {
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
          theme: { color: "#1F6A3A" },
          config: {
            display: {
              blocks: {
                upi: {
                  name: "Pay using UPI (PhonePe / GPay / Paytm / QR)",
                  instruments: [{ method: "upi" }],
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
          handler: (response: RazorpaySuccessPayload) => {
            onSuccess(response);
          },
          modal: {
            ondismiss: () => {
              onCancel("Payment was cancelled by user.");
            },
          },
        };

        const RazorpayConstructor = (window as any).Razorpay;
        rzpRef.current = new RazorpayConstructor(options);

        rzpRef.current.on("payment.failed", (response: any) => {
          const err = response?.error;
          onError(err?.description || err?.reason || "Payment failed.");
        });

        rzpRef.current.open();
      } catch (e: any) {
        onError(e?.message || "Failed to load Razorpay checkout.");
      }
    })();

    return () => {
      cancelled = true;
      try { rzpRef.current?.close(); } catch { /* ignore */ }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, data]);

  // On web Razorpay opens its own modal. We show a thin backdrop with cancel.
  if (!visible || !data) return null;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={() => onCancel("User closed payment window.")}>
      <View style={s.backdrop}>
        <View style={s.card}>
          <FontAwesome6 name="shield-halved" size={32} color="#1F6A3A" />
          <Text style={s.title}>Razorpay Checkout</Text>
          <Text style={s.sub}>A secure payment window is opening…</Text>
          <Pressable style={s.cancelBtn} onPress={() => onCancel("User cancelled.")}>
            <Text style={s.cancelText}>Cancel</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    alignItems: "center",
    justifyContent: "center",
  },
  card: {
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 32,
    alignItems: "center",
    gap: 12,
    maxWidth: 360,
    width: "90%",
  },
  title: {
    fontSize: 18,
    fontWeight: "700",
    color: "#174F2D",
    marginTop: 8,
  },
  sub: {
    fontSize: 14,
    color: "#6D776E",
    textAlign: "center",
  },
  cancelBtn: {
    marginTop: 12,
    backgroundColor: "#E23F32",
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 28,
  },
  cancelText: {
    color: "#fff",
    fontWeight: "700",
    fontSize: 14,
  },
});
