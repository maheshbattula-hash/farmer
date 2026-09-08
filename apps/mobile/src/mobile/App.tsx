import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Animated,
  Easing,
  ImageBackground,
  Linking,
  Pressable,
  RefreshControl,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  useColorScheme,
} from "react-native";
import { FontAwesome6 } from "@expo/vector-icons";
import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context";

import RedesignedAuthLayout from "./auth/RedesignedAuthLayout";
import { resolveApiUrl } from "../config/runtime";
import RazorpayCheckoutModal, { RazorpayCheckoutData, RazorpaySuccessPayload } from "../components/RazorpayCheckoutModal";

// ─── Types ───────────────────────────────────────────────────────────────────
type RootScreen = "splash" | "loading" | "auth" | "app";
type AuthScreen = "login" | "verify" | "register" | "forgot" | "resetVerify" | "resetPassword";
type Purpose = "login" | "password_reset" | "email_verification" | "signup_email_verification";
type Challenge = { challengeId: string; email: string; purpose: Purpose; verified?: boolean };
type UserRole = "admin" | "farmer" | "customer";
type User = {
  id: string; username: string; email: string; role: UserRole;
  full_name: string; city: string; state: string; district: string;
  pincode: string; is_verified: boolean;
};
type ApiResult = { ok: boolean; message: string; payload: Record<string, unknown> };
type Crop = {
  id: string; name: string; price: number; unit: string; location: string;
  verified: boolean; organic: boolean; quantity: number; category: string;
  farmer_name: string; farmer_id: string; image_url?: string;
  min_order_quantity: number;
};
type Order = {
  id: string; crop_name: string; quantity: number; unit: string;
  total_price: number; status: string; payment_status: string;
  payment_method: string; invoice_number: string; tracking_code: string;
  created_at: string; farmer_name?: string; customer_name?: string;
  delivery_address?: string;
};

// ─── Constants ───────────────────────────────────────────────────────────────
const API_URL = resolveApiUrl().replace(/\/$/, "");
const colors = {
  bg: "#F7F5EE", card: "#FFFFFF", green: "#1F6A3A", dark: "#174F2D",
  soft: "#E7F3E6", text: "#1E271F", muted: "#6D776E", border: "#E3E9E0",
  red: "#E23F32", amber: "#C07E12", blue: "#1A5FA8", purple: "#6B3FA0",
  orange: "#C4601A",
};
const splashLightBackground = require("../../assets/splash-light.png");
const splashDarkBackground = require("../../assets/splash-dark.png");
// ─── Root App ─────────────────────────────────────────────────────────────────
export default function App(): React.JSX.Element {
  const colorScheme = useColorScheme();
  const [root, setRoot] = useState<RootScreen>("splash");
  const [authScreen, setAuthScreen] = useState<AuthScreen>("login");
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string>("");
  const [preAuth, setPreAuth] = useState<Challenge | null>(null);
  const [resetAuth, setResetAuth] = useState<Challenge | null>(null);
  const [busy, setBusy] = useState("");
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [testOtp, setTestOtp] = useState("");
  const [login, setLogin] = useState({ email: "", password: "" });
  const [verify, setVerify] = useState({ email: "", otp: "" });
  const [forgot, setForgot] = useState({ email: "" });
  const [resetVerify, setResetVerify] = useState({ email: "", otp: "" });
  const [resetPassword, setResetPassword] = useState({ password: "", confirm_password: "" });
  const [register, setRegister] = useState({
    username: "", email: "", password: "", full_name: "", city: "",
    state: "", district: "", pincode: "", role: "customer", gender: "Male",
  });

  useEffect(() => {
    const splashTimer = setTimeout(() => setRoot("loading"), 2200);
    const authTimer = setTimeout(() => setRoot("auth"), 3800);
    return () => { clearTimeout(splashTimer); clearTimeout(authTimer); };
  }, []);

  const resetNotices = () => { setNotice(""); setError(""); setTestOtp(""); };

  const runBusy = async <T,>(label: string, work: () => Promise<T>): Promise<T> => {
    setBusy(label);
    try { return await work(); } finally { setBusy(""); }
  };

  const startEmailVerification = async (email: string, target: "login" | "register") =>
    runBusy("Sending OTP...", async () => {
      if (target === "register" && isBlockedOtpEmail(email)) {
        return { ok: false, message: "Use a real email inbox.", challengeId: "", email: email.trim().toLowerCase(), otp: "", purpose: "signup_email_verification" as const };
      }
      const purpose: Extract<Purpose, "email_verification" | "signup_email_verification"> =
        target === "register" ? "signup_email_verification" : "email_verification";
      const result = await apiRequest("/api/auth/email-verification/start/", { email, purpose });
      return {
        ok: result.ok, message: result.message,
        challengeId: txt(result.payload.challenge_id),
        email: txt(result.payload.email) || email.trim().toLowerCase(),
        otp: txt(result.payload.otp),
        purpose: txt(result.payload.purpose) || purpose,
      };
    });

  const completeEmailVerification = async ({ challengeId, email, otp, purpose }: { challengeId: string; email: string; otp: string; purpose: Extract<Purpose, "email_verification" | "signup_email_verification"> }) =>
    runBusy("Verifying OTP...", async () => {
      const result = await apiRequest("/api/auth/verify-otp/", { challenge_id: challengeId, email, otp, purpose });
      return { ok: result.ok, message: result.message, otp: txt(result.payload.otp) };
    });

  const requestOtp = async (challenge: Challenge) => {
    const result = await apiRequest("/api/auth/request-otp/", { challenge_id: challenge.challengeId, email: challenge.email, purpose: challenge.purpose });
    if (!result.ok) { setError(result.message); return; }
    const otp = txt(result.payload.otp);
    setTestOtp(otp);
    setNotice(otp ? `OTP sent. Test code: ${otp}` : result.message);
  };

  const startChallenge = async (challenge: Challenge, screen: AuthScreen) => {
    resetNotices();
    if (screen === "verify") { setPreAuth(challenge); setVerify({ email: challenge.email, otp: "" }); }
    else { setResetAuth({ ...challenge, verified: false }); setResetVerify({ email: challenge.email, otp: "" }); }
    setAuthScreen(screen);
    await requestOtp(challenge);
  };

  const submitLogin = async ({ challengeId, email, password }: { challengeId: string; email: string; password: string }) =>
    runBusy("Logging in...", async () => {
      const result = await apiRequest("/api/auth/login-after-email-verification/", { challenge_id: challengeId, email, password });
      if (!result.ok) return { ok: false, message: result.message };
      const nextUser = asUser(result.payload.user);
      if (!nextUser) return { ok: false, message: "Login completed but no user was returned." };
      const tok = txt(result.payload.token);
      setUser(nextUser); setToken(tok); setRoot("app");
      return { ok: true, message: result.message };
    });

  const submitVerify = async () => runBusy("Verifying OTP...", async () => {
    if (!preAuth) { setError("Please login first."); setAuthScreen("login"); return; }
    resetNotices();
    const result = await apiRequest("/api/auth/verify-otp/", { challenge_id: preAuth.challengeId, email: verify.email, otp: verify.otp, purpose: preAuth.purpose });
    if (!result.ok) { setError(result.message); return; }
    const nextUser = asUser(result.payload.user);
    if (!nextUser) { setError("Login completed but no user was returned."); return; }
    const tok = txt(result.payload.token);
    setUser(nextUser); setToken(tok); setPreAuth(null); setRoot("app");
  });

  const submitRegister = async (payload = register) => runBusy("Creating account...", async () => {
    const result = await apiRequest("/api/auth/register/", payload);
    if (!result.ok) return { ok: false, message: result.message };
    setLogin((c) => ({ ...c, email: payload.email }));
    setRegister({ username: "", email: "", password: "", full_name: "", city: "", state: "", district: "", pincode: "", role: "customer", gender: "Male" });
    return { ok: true, message: result.message };
  });

  const submitForgot = async () => runBusy("Starting reset...", async () => {
    resetNotices();
    const result = await apiRequest("/api/auth/forgot-password/", forgot);
    if (!result.ok) { setError(result.message); return; }
    await startChallenge({ challengeId: txt(result.payload.challenge_id), email: txt(result.payload.email) || forgot.email.trim().toLowerCase(), purpose: "password_reset" }, "resetVerify");
  });

  const submitResetVerify = async () => runBusy("Verifying reset OTP...", async () => {
    if (!resetAuth) { setError("Start the password reset flow first."); setAuthScreen("forgot"); return; }
    resetNotices();
    const result = await apiRequest("/api/auth/verify-otp/", { challenge_id: resetAuth.challengeId, email: resetVerify.email, otp: resetVerify.otp, purpose: resetAuth.purpose });
    if (!result.ok) { setError(result.message); return; }
    setResetAuth({ ...resetAuth, verified: true }); setNotice(result.message); setAuthScreen("resetPassword");
  });

  const submitResetPassword = async () => runBusy("Updating password...", async () => {
    if (!resetAuth?.verified) { setError("Complete OTP verification first."); setAuthScreen("resetVerify"); return; }
    resetNotices();
    const result = await apiRequest("/api/auth/reset-password/", { challenge_id: resetAuth.challengeId, password: resetPassword.password, confirm_password: resetPassword.confirm_password });
    if (!result.ok) { setError(result.message); return; }
    setResetAuth(null); setResetPassword({ password: "", confirm_password: "" }); setNotice(result.message); setAuthScreen("login");
  });

  const logout = () => { setUser(null); setToken(""); setRoot("auth"); setAuthScreen("login"); setNotice("You have been logged out."); setError(""); };

  return (
    <SafeAreaProvider>
      <SafeAreaView style={s.safe}>
        <StatusBar barStyle="dark-content" backgroundColor={colors.bg} />
        {root === "splash" ? <Splash darkMode={colorScheme === "dark"} /> : null}
        {root === "loading" ? <LoadingScreen darkMode={colorScheme === "dark"} /> : null}
        {root === "auth" ? (
          authScreen === "login" || authScreen === "register" ? (
            <RedesignedAuthLayout
              authScreen={authScreen}
              busy={busy}
              login={login}
              onCompleteEmailVerification={completeEmailVerification}
              onLogin={submitLogin}
              onRegister={submitRegister}
              onStartEmailVerification={startEmailVerification}
              register={register}
              setAuthScreen={(next) => { resetNotices(); setAuthScreen(next); }}
              setLogin={setLogin}
              setRegister={setRegister}
            />
          ) : (
            <LegacyAuthLayout
              authScreen={authScreen} busy={busy} error={error} forgot={forgot} login={login}
              notice={notice} register={register} resetPassword={resetPassword} resetVerify={resetVerify}
              setAuthScreen={(next) => { resetNotices(); setAuthScreen(next); }}
              setForgot={setForgot} setLogin={setLogin} setRegister={setRegister}
              setResetPassword={setResetPassword} setResetVerify={setResetVerify}
              setVerify={setVerify} setTestOtp={setTestOtp} submitForgot={submitForgot}
              submitResetPassword={submitResetPassword} submitResetVerify={submitResetVerify}
              submitVerify={submitVerify} testOtp={testOtp} verify={verify}
              resend={() => runBusy("Sending OTP...", () => requestOtp(authScreen === "verify" ? preAuth! : resetAuth!))}
            />
          )
        ) : null}
        {root === "app" && user ? (
          user.role === "admin" ? (
            <AdminShell user={user} token={token} logout={logout} />
          ) : user.role === "farmer" ? (
            <FarmerShell user={user} token={token} logout={logout} />
          ) : (
            <CustomerShell user={user} token={token} logout={logout} />
          )
        ) : null}
      </SafeAreaView>
    </SafeAreaProvider>
  );
}

// ─── ADMIN SHELL ─────────────────────────────────────────────────────────────
type AdminTab = "dashboard" | "orders" | "profile";
function AdminShell({ user, token, logout }: { user: User; token: string; logout: () => void }) {
  const [tab, setTab] = useState<AdminTab>("dashboard");
  const [stats, setStats] = useState<any>(null);
  const [orders, setOrders] = useState<any[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [busy, setBusy] = useState("");

  const loadData = useCallback(async () => {
    setRefreshing(true);
    try {
      const [dashRes, ordRes] = await Promise.all([
        authGet("/api/orders/admin/dashboard", token),
        authGet("/api/orders/admin/dashboard", token),
      ]);
      if (dashRes.ok) setStats(dashRes.payload);
      if (ordRes.ok) setOrders((ordRes.payload.orders as any[]) || []);
    } finally { setRefreshing(false); }
  }, [token]);

  useEffect(() => { loadData(); }, [loadData]);

  const updateOrderStatus = async (orderId: string, status: string) => {
    setBusy(orderId);
    const res = await authPatch(`/api/orders/admin/orders/${orderId}/status`, { status }, token);
    if (res.ok) { Alert.alert("Updated", `Order status set to ${status}`); loadData(); }
    else Alert.alert("Error", res.message);
    setBusy("");
  };

  const statItems = [
    { label: "Total Orders", value: txt(stats?.total_orders), icon: "receipt", color: colors.blue },
    { label: "Active", value: txt(stats?.active_orders), icon: "truck", color: colors.orange },
    { label: "Delivered", value: txt(stats?.delivered_orders), icon: "circle-check", color: colors.green },
    { label: "Revenue", value: `₹${txt(stats?.total_revenue)}`, icon: "indian-rupee-sign", color: colors.purple },
  ];

  return (
    <View style={{ flex: 1 }}>
      {tab === "dashboard" && (
        <ScrollView contentContainerStyle={s.page} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={loadData} tintColor={colors.green} />}>
          <View style={s.roleHeader}>
            <View style={[s.roleBadge, { backgroundColor: colors.purple }]}>
              <FontAwesome6 name="shield-halved" size={14} color="#fff" />
              <Text style={s.roleBadgeText}>ADMIN</Text>
            </View>
            <Text style={s.pageTitle}>Admin Dashboard</Text>
            <Text style={s.pageSub}>Welcome back, {user.full_name || user.username}</Text>
          </View>
          <View style={s.statsGrid}>
            {statItems.map((item) => (
              <View key={item.label} style={[s.statCard, { borderLeftColor: item.color }]}>
                <FontAwesome6 name={item.icon as any} size={20} color={item.color} />
                <Text style={[s.statValue, { color: item.color }]}>{item.value || "—"}</Text>
                <Text style={s.statLabel}>{item.label}</Text>
              </View>
            ))}
          </View>
          <Text style={s.sectionHeading}>Recent Orders</Text>
          {orders.slice(0, 5).map((order: any) => (
            <View key={order.id || order._id} style={s.listCard}>
              <View style={s.rowBetween}>
                <Text style={s.cardTitle}>{order.crop_name || order.crop?.name || "Crop Order"}</Text>
                <StatusChip label={order.status} />
              </View>
              <Text style={s.cardMeta}>Customer: {order.customer_name || order.customer?.username || "—"}</Text>
              <Text style={s.cardMeta}>₹{order.total_price} · {order.payment_method || "—"}</Text>
              <View style={[s.row, { marginTop: 8 }]}>
                {["Order Confirmed", "Packed", "Shipped", "Delivered"].map((st) => (
                  <Pressable key={st} style={[s.miniBtn, order.status === st && { backgroundColor: colors.green }]}
                    onPress={() => updateOrderStatus(order.id || order._id, st)}
                    disabled={busy === (order.id || order._id)}>
                    <Text style={[s.miniBtnText, order.status === st && { color: "#fff" }]}>{st.replace("Order ", "")}</Text>
                  </Pressable>
                ))}
              </View>
            </View>
          ))}
          {orders.length === 0 && !refreshing && <EmptyState icon="receipt" text="No orders yet" />}
        </ScrollView>
      )}
      {tab === "orders" && (
        <ScrollView contentContainerStyle={s.page} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={loadData} tintColor={colors.green} />}>
          <Text style={s.pageTitle}>All Orders</Text>
          {orders.map((order: any) => (
            <View key={order.id || order._id} style={s.listCard}>
              <View style={s.rowBetween}>
                <Text style={s.cardTitle}>{order.crop_name || order.crop?.name || "Crop Order"}</Text>
                <StatusChip label={order.status} />
              </View>
              <Text style={s.cardMeta}>#{order.invoice_number || "—"} · {order.quantity} {order.unit || "kg"}</Text>
              <Text style={s.cardMeta}>Customer: {order.customer_name || order.customer?.username || "—"}</Text>
              <Text style={s.cardMeta}>Payment: {order.payment_status} via {order.payment_method || "—"}</Text>
              <Text style={s.cardMeta}>₹{order.total_price}</Text>
            </View>
          ))}
          {orders.length === 0 && !refreshing && <EmptyState icon="receipt" text="No orders yet" />}
        </ScrollView>
      )}
      {tab === "profile" && (
        <ScrollView contentContainerStyle={s.page}>
          <Text style={s.pageTitle}>Admin Profile</Text>
          <View style={s.listCard}>
            <View style={[s.avatarCircle, { backgroundColor: colors.purple }]}>
              <FontAwesome6 name="shield-halved" size={28} color="#fff" />
            </View>
            <Text style={[s.cardTitle, { marginTop: 12 }]}>{user.full_name || user.username}</Text>
            <Text style={s.cardMeta}>{user.email}</Text>
            <Text style={[s.cardMeta, { marginTop: 6 }]}>Role: Administrator</Text>
          </View>
          <BigBtn label="Logout" color={colors.red} onPress={logout} icon="right-from-bracket" />
        </ScrollView>
      )}
      <BottomNav
        tabs={[
          { key: "dashboard", icon: "gauge", label: "Dashboard" },
          { key: "orders", icon: "receipt", label: "Orders" },
          { key: "profile", icon: "user-shield", label: "Profile" },
        ]}
        active={tab}
        setActive={(k) => setTab(k as AdminTab)}
      />
    </View>
  );
}

// ─── FARMER SHELL ─────────────────────────────────────────────────────────────
type FarmerTab = "dashboard" | "crops" | "orders" | "profile";
function FarmerShell({ user, token, logout }: { user: User; token: string; logout: () => void }) {
  const [tab, setTab] = useState<FarmerTab>("dashboard");
  const [dashboard, setDashboard] = useState<any>(null);
  const [crops, setCrops] = useState<any[]>([]);
  const [orders, setOrders] = useState<any[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [showAddCrop, setShowAddCrop] = useState(false);
  const [newCrop, setNewCrop] = useState({ name: "", price: "", unit: "kg", quantity: "", category: "Vegetables", description: "" });
  const [busy, setBusy] = useState("");

  const loadData = useCallback(async () => {
    setRefreshing(true);
    try {
      const [dashRes, cropRes] = await Promise.all([
        authGet("/api/marketplace/farmer/dashboard", token),
        authGet("/api/marketplace/farmer/dashboard", token),
      ]);
      if (dashRes.ok) {
        setDashboard(dashRes.payload);
        setCrops((dashRes.payload.crops as any[]) || []);
        setOrders((dashRes.payload.recent_orders as any[]) || []);
      }
    } finally { setRefreshing(false); }
  }, [token]);

  useEffect(() => { loadData(); }, [loadData]);

  const addCrop = async () => {
    if (!newCrop.name || !newCrop.price || !newCrop.quantity) { Alert.alert("Error", "Please fill name, price and quantity"); return; }
    setBusy("Adding crop...");
    const res = await authPost("/api/marketplace/farmer/crops", {
      name: newCrop.name, price: parseFloat(newCrop.price), unit: newCrop.unit,
      quantity: parseFloat(newCrop.quantity), category: newCrop.category, description: newCrop.description,
    }, token);
    setBusy("");
    if (res.ok) { Alert.alert("Success", "Crop listed!"); setShowAddCrop(false); setNewCrop({ name: "", price: "", unit: "kg", quantity: "", category: "Vegetables", description: "" }); loadData(); }
    else Alert.alert("Error", res.message);
  };

  const updateOrderStatus = async (orderId: string, status: string) => {
    const res = await authPost("/api/orders/farmer/update-status", { order_id: orderId, status }, token);
    if (res.ok) { Alert.alert("Updated", `Order marked as ${status}`); loadData(); }
    else Alert.alert("Error", res.message);
  };

  const stats = [
    { label: "My Crops", value: txt((dashboard?.crops as any[])?.length), icon: "seedling", color: colors.green },
    { label: "Pending Orders", value: txt(dashboard?.pending_orders), icon: "clock", color: colors.amber },
    { label: "Total Earnings", value: `₹${txt(dashboard?.total_earnings)}`, icon: "indian-rupee-sign", color: colors.blue },
  ];

  return (
    <View style={{ flex: 1 }}>
      {tab === "dashboard" && (
        <ScrollView contentContainerStyle={s.page} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={loadData} tintColor={colors.green} />}>
          <View style={s.roleHeader}>
            <View style={[s.roleBadge, { backgroundColor: colors.green }]}>
              <FontAwesome6 name="tractor" size={13} color="#fff" />
              <Text style={s.roleBadgeText}>FARMER</Text>
            </View>
            <Text style={s.pageTitle}>Farmer Dashboard</Text>
            <Text style={s.pageSub}>Welcome, {user.full_name || user.username}</Text>
          </View>
          <View style={[s.statsGrid, { gridTemplateColumns: undefined }]}>
            {stats.map((item) => (
              <View key={item.label} style={[s.statCard, { borderLeftColor: item.color }]}>
                <FontAwesome6 name={item.icon as any} size={20} color={item.color} />
                <Text style={[s.statValue, { color: item.color }]}>{item.value || "0"}</Text>
                <Text style={s.statLabel}>{item.label}</Text>
              </View>
            ))}
          </View>
          <Text style={s.sectionHeading}>Pending Orders</Text>
          {orders.filter((o: any) => o.status === "Order Placed").map((order: any) => (
            <View key={order.id} style={[s.listCard, { borderLeftWidth: 4, borderLeftColor: colors.amber }]}>
              <View style={s.rowBetween}>
                <Text style={s.cardTitle}>{order.crop_name}</Text>
                <StatusChip label={order.status} />
              </View>
              <Text style={s.cardMeta}>{order.quantity} {order.unit} · ₹{order.total_price}</Text>
              <Text style={s.cardMeta}>Customer: {order.customer_name || "—"}</Text>
              <View style={[s.row, { marginTop: 8 }]}>
                <Pressable style={[s.miniBtn, { backgroundColor: colors.green }]} onPress={() => updateOrderStatus(order.id, "Order Confirmed")}>
                  <Text style={[s.miniBtnText, { color: "#fff" }]}>Accept</Text>
                </Pressable>
                <Pressable style={[s.miniBtn, { backgroundColor: colors.red }]} onPress={() => updateOrderStatus(order.id, "Cancelled")}>
                  <Text style={[s.miniBtnText, { color: "#fff" }]}>Reject</Text>
                </Pressable>
              </View>
            </View>
          ))}
          {orders.filter((o: any) => o.status === "Order Placed").length === 0 && (
            <View style={[s.listCard, { alignItems: "center", padding: 20 }]}>
              <Text style={s.cardMeta}>No pending orders 🎉</Text>
            </View>
          )}
        </ScrollView>
      )}
      {tab === "crops" && (
        <ScrollView contentContainerStyle={s.page} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={loadData} tintColor={colors.green} />}>
          <View style={s.rowBetween}>
            <Text style={s.pageTitle}>My Crops</Text>
            <Pressable style={[s.miniBtn, { backgroundColor: colors.green }]} onPress={() => setShowAddCrop(!showAddCrop)}>
              <Text style={[s.miniBtnText, { color: "#fff" }]}>{showAddCrop ? "Cancel" : "+ List Crop"}</Text>
            </Pressable>
          </View>
          {showAddCrop && (
            <View style={[s.listCard, { borderColor: colors.green }]}>
              <Text style={s.sectionHeading}>List New Crop</Text>
              {[
                { label: "Crop Name", key: "name", placeholder: "e.g. Tomatoes" },
                { label: "Price per unit (₹)", key: "price", placeholder: "e.g. 45", keyboard: "numeric" as const },
                { label: "Unit", key: "unit", placeholder: "kg / bunch / piece" },
                { label: "Available Quantity", key: "quantity", placeholder: "e.g. 100", keyboard: "numeric" as const },
                { label: "Description", key: "description", placeholder: "Optional details" },
              ].map((f) => (
                <View key={f.key} style={{ marginBottom: 10 }}>
                  <Text style={s.fieldLabel}>{f.label}</Text>
                  <TextInput
                    style={s.input} placeholder={f.placeholder} placeholderTextColor="#8A938C"
                    keyboardType={f.keyboard || "default"}
                    value={(newCrop as any)[f.key]}
                    onChangeText={(v) => setNewCrop((c) => ({ ...c, [f.key]: v }))}
                  />
                </View>
              ))}
              <BigBtn label={busy || "List Crop"} color={colors.green} onPress={addCrop} disabled={Boolean(busy)} icon="seedling" />
            </View>
          )}
          {crops.map((crop: any) => (
            <View key={crop.id} style={s.listCard}>
              <View style={s.rowBetween}>
                <Text style={s.cardTitle}>{crop.name}</Text>
                {crop.is_verified ? <StatusChip label="Verified" green /> : <StatusChip label="Pending" />}
              </View>
              <Text style={s.cardMeta}>₹{crop.price}/{crop.unit} · {crop.quantity} {crop.unit} available</Text>
              <Text style={s.cardMeta}>{crop.category} · {crop.location || user.city || "—"}</Text>
            </View>
          ))}
          {crops.length === 0 && !refreshing && <EmptyState icon="seedling" text="No crops listed yet. Add your first crop!" />}
        </ScrollView>
      )}
      {tab === "orders" && (
        <ScrollView contentContainerStyle={s.page} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={loadData} tintColor={colors.green} />}>
          <Text style={s.pageTitle}>My Orders</Text>
          {orders.map((order: any) => (
            <View key={order.id} style={s.listCard}>
              <View style={s.rowBetween}>
                <Text style={s.cardTitle}>{order.crop_name}</Text>
                <StatusChip label={order.status} />
              </View>
              <Text style={s.cardMeta}>{order.quantity} {order.unit} · ₹{order.total_price}</Text>
              <Text style={s.cardMeta}>Customer: {order.customer_name || "—"}</Text>
              <Text style={s.cardMeta}>Payment: {order.payment_status}</Text>
              {["Order Confirmed", "Packed", "Shipped", "Out for Delivery", "Delivered"].includes(order.status) && (
                <View style={[s.row, { marginTop: 8 }]}>
                  {order.status !== "Delivered" && (
                    <Pressable style={[s.miniBtn, { backgroundColor: colors.green }]}
                      onPress={() => updateOrderStatus(order.id, order.status === "Order Confirmed" ? "Packed" : order.status === "Packed" ? "Shipped" : order.status === "Shipped" ? "Out for Delivery" : "Delivered")}>
                      <Text style={[s.miniBtnText, { color: "#fff" }]}>
                        Mark {order.status === "Order Confirmed" ? "Packed" : order.status === "Packed" ? "Shipped" : order.status === "Shipped" ? "Out for Delivery" : "Delivered"}
                      </Text>
                    </Pressable>
                  )}
                </View>
              )}
            </View>
          ))}
          {orders.length === 0 && !refreshing && <EmptyState icon="receipt" text="No orders yet" />}
        </ScrollView>
      )}
      {tab === "profile" && (
        <ScrollView contentContainerStyle={s.page}>
          <Text style={s.pageTitle}>Profile</Text>
          <View style={s.listCard}>
            <View style={[s.avatarCircle, { backgroundColor: colors.green }]}>
              <FontAwesome6 name="tractor" size={28} color="#fff" />
            </View>
            <Text style={[s.cardTitle, { marginTop: 12 }]}>{user.full_name || user.username}</Text>
            <Text style={s.cardMeta}>{user.email}</Text>
            <Text style={s.cardMeta}>{[user.city, user.district, user.state].filter(Boolean).join(", ")}</Text>
            <View style={[s.roleBadge, { backgroundColor: colors.green, marginTop: 10, alignSelf: "flex-start" }]}>
              <FontAwesome6 name="tractor" size={12} color="#fff" />
              <Text style={s.roleBadgeText}>Verified Farmer</Text>
            </View>
          </View>
          <BigBtn label="Logout" color={colors.red} onPress={logout} icon="right-from-bracket" />
        </ScrollView>
      )}
      <BottomNav
        tabs={[
          { key: "dashboard", icon: "house", label: "Home" },
          { key: "crops", icon: "seedling", label: "My Crops" },
          { key: "orders", icon: "receipt", label: "Orders" },
          { key: "profile", icon: "user", label: "Profile" },
        ]}
        active={tab}
        setActive={(k) => setTab(k as FarmerTab)}
      />
    </View>
  );
}

// ─── CUSTOMER SHELL ───────────────────────────────────────────────────────────
type CustomerTab = "marketplace" | "orders" | "profile";
type PaymentMethod = "COD" | "ONLINE";
type CheckoutState = { crop: any; qty: number } | null;

function CustomerShell({ user, token, logout }: { user: User; token: string; logout: () => void }) {
  const [tab, setTab] = useState<CustomerTab>("marketplace");
  const [crops, setCrops] = useState<any[]>([]);
  const [orders, setOrders] = useState<{ active: any[]; history: any[] }>({ active: [], history: [] });
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState("");
  const [checkout, setCheckout] = useState<CheckoutState>(null);
  const [payMethod, setPayMethod] = useState<PaymentMethod>("ONLINE");
  const [adminUpiId, setAdminUpiId] = useState("");
  const [payBusy, setPayBusy] = useState("");
  const [paySuccess, setPaySuccess] = useState<any>(null);

  // Razorpay state
  const [rzpModalVisible, setRzpModalVisible] = useState(false);
  const [rzpCheckoutData, setRzpCheckoutData] = useState<RazorpayCheckoutData | null>(null);
  const [pendingOrderId, setPendingOrderId] = useState<string>("");

  const loadCrops = useCallback(async () => {
    const res = await authGet("/api/marketplace/crops", token);
    if (res.ok) setCrops((res.payload.crops as any[]) || []);
  }, [token]);

  const loadOrders = useCallback(async () => {
    const res = await authGet("/api/orders/my", token);
    if (res.ok) {
      setOrders({ active: (res.payload.active_orders as any[]) || [], history: (res.payload.order_history as any[]) || [] });
    }
  }, [token]);

  const loadPaymentConfig = useCallback(async () => {
    const res = await apiRequest("/api/config/payment", {});
    if (res.ok) setAdminUpiId(txt(res.payload.upi_id));
  }, []);

  const loadAll = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([loadCrops(), loadOrders(), loadPaymentConfig()]);
    setRefreshing(false);
  }, [loadCrops, loadOrders, loadPaymentConfig]);

  useEffect(() => { loadAll(); }, [loadAll]);

  const visibleCrops = useMemo(() =>
    crops.filter((c) => c.name?.toLowerCase().includes(search.toLowerCase()) || c.category?.toLowerCase().includes(search.toLowerCase())),
    [crops, search]
  );

  const placeOrder = async () => {
    if (!checkout) return;
    setPayBusy("Placing order...");
    const res = await authPost("/api/orders/place", {
      crop_id: checkout.crop.id || checkout.crop._id,
      quantity: checkout.qty,
      payment_method: payMethod === "COD" ? "COD" : "Online (Razorpay)",
    }, token);
    setPayBusy("");
    if (!res.ok) { Alert.alert("Error", res.message); return; }
    const orderId = txt(res.payload.order_id);
    if (payMethod === "COD") {
      await confirmCODPayment(orderId, checkout.crop);
    } else {
      await initiateRazorpayPayment(orderId, checkout.crop, checkout.qty);
    }
  };

  const confirmCODPayment = async (orderId: string, crop: any) => {
    setPayBusy("Confirming COD order...");
    const res = await authPost("/api/orders/confirm-payment", {
      order_id: orderId, payment_method: "COD", payment_provider: "Cash on Delivery", upi_id: "",
    }, token);
    setPayBusy("");
    if (res.ok) {
      setPaySuccess({ method: "Cash on Delivery", reference: txt((res.payload.gateway as any)?.reference), cropName: crop.name });
      setCheckout(null);
      loadOrders();
    } else Alert.alert("Error", res.message);
  };

  const initiateRazorpayPayment = async (orderId: string, crop: any, qty: number) => {
    setPayBusy("Initializing Razorpay Order...");
    const res = await authPost("/api/payments/create-order", { orderId }, token);
    setPayBusy("");
    if (!res.ok) {
      Alert.alert("Payment Error", res.message || "Failed to create Razorpay order.");
      return;
    }

    const payload = res.payload as any;
    const rzpOrderId = txt(payload.razorpayOrderId);
    const keyId = txt(payload.keyId);
    const amount = Number(payload.amount || Number(crop.price || 0) * qty);
    const amountPaise = Number(payload.amountPaise || Math.round(amount * 100));
    const currency = txt(payload.currency || "INR");

    setPendingOrderId(orderId);
    setRzpCheckoutData({
      keyId,
      razorpayOrderId: rzpOrderId,
      amount,
      amountPaise,
      currency,
      orderId,
      customerName: user.full_name || user.username || "",
      customerEmail: user.email || "",
      cropName: crop.name || "Crop Order",
    });
    setRzpModalVisible(true);
  };

  const handleRazorpaySuccess = async (rzpPayload: RazorpaySuccessPayload) => {
    setRzpModalVisible(false);
    setPayBusy("Verifying payment with server...");
    const res = await authPost("/api/payments/verify", {
      internalOrderId: pendingOrderId,
      razorpay_order_id: rzpPayload.razorpay_order_id,
      razorpay_payment_id: rzpPayload.razorpay_payment_id,
      razorpay_signature: rzpPayload.razorpay_signature,
    }, token);
    setPayBusy("");
    if (res.ok) {
      setPaySuccess({
        method: "Online Payment (Razorpay)",
        reference: rzpPayload.razorpay_payment_id,
        cropName: checkout?.crop?.name || "Order",
        amount: checkout ? (Number(checkout.crop.price || 0) * checkout.qty).toFixed(2) : "",
      });
      setCheckout(null);
      setRzpCheckoutData(null);
      setPendingOrderId("");
      loadOrders();
      Alert.alert("Payment Successful 🎉", "Your payment has been verified by the server!");
    } else {
      Alert.alert("Verification Failed ❌", res.message || "Payment signature verification failed. Order remains unpaid.");
    }
  };

  const cancelOrder = async (orderId: string) => {
    Alert.alert("Cancel Order", "Are you sure?", [
      {
        text: "Yes, Cancel", style: "destructive",
        onPress: async () => {
          const res = await authPost(`/api/orders/${orderId}/cancel`, {}, token);
          if (res.ok) { Alert.alert("Cancelled", "Order has been cancelled."); loadOrders(); }
          else Alert.alert("Error", res.message);
        },
      },
      { text: "No", style: "cancel" },
    ]);
  };

  const totalActive = orders.active.length;
  const totalSpent = orders.history.filter((o) => o.status === "Delivered").reduce((sum, o) => sum + Number(o.total_price || 0), 0);

  return (
    <View style={{ flex: 1 }}>
      {/* Payment Success Banner */}
      {paySuccess && (
        <View style={s.successBanner}>
          <FontAwesome6 name="circle-check" size={22} color="#fff" />
          <View style={{ flex: 1, marginLeft: 10 }}>
            <Text style={s.successTitle}>Payment confirmed! 🎉</Text>
            <Text style={s.successSub}>{paySuccess.cropName} · {paySuccess.method}</Text>
            {paySuccess.reference ? <Text style={s.successSub}>Ref: {paySuccess.reference}</Text> : null}
          </View>
          <Pressable onPress={() => setPaySuccess(null)}><FontAwesome6 name="xmark" size={16} color="#fff" /></Pressable>
        </View>
      )}

      {/* MARKETPLACE TAB */}
      {tab === "marketplace" && (
        <ScrollView contentContainerStyle={s.page} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={loadAll} tintColor={colors.green} />}>
          <View style={s.roleHeader}>
            <View style={[s.roleBadge, { backgroundColor: colors.blue }]}>
              <FontAwesome6 name="user" size={12} color="#fff" />
              <Text style={s.roleBadgeText}>CUSTOMER</Text>
            </View>
            <Text style={s.pageTitle}>Marketplace</Text>
          </View>

          {/* Search */}
          <View style={s.searchBox}>
            <FontAwesome6 name="magnifying-glass" size={16} color={colors.muted} />
            <TextInput style={s.searchInput} placeholder="Search crops, categories..." placeholderTextColor="#8A938C" value={search} onChangeText={setSearch} />
          </View>

          {/* Checkout Modal */}
          {checkout && (
            <View style={[s.listCard, { borderColor: colors.green, borderWidth: 2 }]}>
              <View style={s.rowBetween}>
                <Text style={s.sectionHeading}>Checkout</Text>
                <Pressable onPress={() => setCheckout(null)}><FontAwesome6 name="xmark" size={18} color={colors.muted} /></Pressable>
              </View>
              <Text style={s.cardMeta}>{checkout.crop.name} · ₹{checkout.crop.price}/{checkout.crop.unit}</Text>

              {/* Quantity */}
              <View style={{ marginVertical: 10 }}>
                <Text style={s.fieldLabel}>Quantity ({checkout.crop.unit})</Text>
                <View style={s.qtyRow}>
                  <Pressable style={s.qtyBtn} onPress={() => setCheckout((c) => c && c.qty > 1 ? { ...c, qty: c.qty - 1 } : c)}>
                    <FontAwesome6 name="minus" size={14} color={colors.dark} />
                  </Pressable>
                  <Text style={s.qtyText}>{checkout.qty}</Text>
                  <Pressable style={s.qtyBtn} onPress={() => setCheckout((c) => c ? { ...c, qty: c.qty + 1 } : c)}>
                    <FontAwesome6 name="plus" size={14} color={colors.dark} />
                  </Pressable>
                </View>
              </View>

              {/* Total */}
              <View style={s.totalRow}>
                <Text style={s.totalLabel}>Total Amount</Text>
                <Text style={s.totalValue}>₹{(Number(checkout.crop.price) * checkout.qty).toFixed(2)}</Text>
              </View>

              {/* Payment Methods */}
              <Text style={[s.fieldLabel, { marginTop: 12 }]}>Payment Method</Text>
              <View style={s.payMethodRow}>
                {(["COD", "ONLINE"] as PaymentMethod[]).map((m) => (
                  <Pressable key={m} style={[s.payMethodBtn, payMethod === m && s.payMethodBtnActive]} onPress={() => setPayMethod(m)}>
                    <FontAwesome6
                      name={m === "COD" ? "hand-holding-dollar" : "credit-card"}
                      size={16} color={payMethod === m ? "#fff" : colors.dark}
                    />
                    <Text style={[s.payMethodText, payMethod === m && s.payMethodTextActive]}>{m === "COD" ? "Cash on Delivery" : "Online Payment"}</Text>
                  </Pressable>
                ))}
              </View>

              {/* COD info */}
              {payMethod === "COD" && (
                <View style={s.payInfoBox}>
                  <FontAwesome6 name="hand-holding-dollar" size={16} color={colors.amber} />
                  <Text style={s.payInfoText}>Pay cash when your order arrives. No advance payment needed.</Text>
                </View>
              )}

              {/* ONLINE info */}
              {payMethod === "ONLINE" && (
                <View style={s.payInfoBox}>
                  <FontAwesome6 name="credit-card" size={16} color={colors.blue} />
                  <Text style={s.payInfoText}>
                    Pay securely using UPI, Credit/Debit Cards, Netbanking, or Wallets via Razorpay.
                  </Text>
                </View>
              )}

              {payBusy ? (
                <View style={[s.payInfoBox, { justifyContent: "center" }]}>
                  <ActivityIndicator color={colors.green} />
                  <Text style={[s.payInfoText, { marginLeft: 10 }]}>{payBusy}</Text>
                </View>
              ) : (
                <BigBtn
                  label={payMethod === "COD" ? "Confirm Order (COD)" : `Pay ₹${(Number(checkout.crop.price) * checkout.qty).toFixed(2)} Online`}
                  color={payMethod === "COD" ? colors.amber : colors.blue}
                  onPress={placeOrder}
                  icon={payMethod === "COD" ? "hand-holding-dollar" : "credit-card"}
                />
              )}
            </View>
          )}

          {/* Crop listing */}
          {visibleCrops.map((crop: any) => (
            <View key={crop.id || crop._id} style={s.listCard}>
              <View style={s.rowBetween}>
                <View style={{ flex: 1 }}>
                  <Text style={s.cardTitle}>{crop.name}</Text>
                  <Text style={s.cardMeta}>{crop.location || crop.city || "—"} · ₹{crop.price}/{crop.unit}</Text>
                </View>
                {crop.is_verified ? <StatusChip label="Verified" green /> : null}
              </View>
              <View style={[s.row, { marginTop: 8 }]}>
                {crop.category ? <View style={s.tag}><Text style={s.tagText}>{crop.category}</Text></View> : null}
                {crop.is_organic ? <View style={[s.tag, { backgroundColor: colors.soft }]}><Text style={s.tagText}>Organic</Text></View> : null}
                <View style={s.tag}><Text style={s.tagText}>{crop.quantity} {crop.unit} left</Text></View>
              </View>
              <Text style={s.cardMeta}>by {crop.farmer_name || crop.farmer?.full_name || "Farmer"}</Text>
              <BigBtn
                label="Buy Now"
                color={colors.green}
                onPress={() => { setCheckout({ crop, qty: Number(crop.min_order_quantity || 1) }); setPayMethod("ONLINE"); }}
                icon="cart-shopping"
              />
            </View>
          ))}
          {visibleCrops.length === 0 && !refreshing && <EmptyState icon="store" text={search ? "No crops match your search" : "No crops available yet"} />}
        </ScrollView>
      )}

      {/* ORDERS TAB */}
      {tab === "orders" && (
        <ScrollView contentContainerStyle={s.page} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={loadAll} tintColor={colors.green} />}>
          <Text style={s.pageTitle}>My Orders</Text>
          <View style={s.statsGrid}>
            <View style={[s.statCard, { borderLeftColor: colors.blue }]}>
              <FontAwesome6 name="truck" size={18} color={colors.blue} />
              <Text style={[s.statValue, { color: colors.blue }]}>{totalActive}</Text>
              <Text style={s.statLabel}>Active</Text>
            </View>
            <View style={[s.statCard, { borderLeftColor: colors.green }]}>
              <FontAwesome6 name="indian-rupee-sign" size={18} color={colors.green} />
              <Text style={[s.statValue, { color: colors.green }]}>₹{totalSpent.toFixed(0)}</Text>
              <Text style={s.statLabel}>Spent</Text>
            </View>
          </View>
          {orders.active.length > 0 && <Text style={s.sectionHeading}>Active Orders</Text>}
          {orders.active.map((order: any) => (
            <View key={order.id} style={[s.listCard, { borderLeftWidth: 4, borderLeftColor: colors.blue }]}>
              <View style={s.rowBetween}>
                <Text style={s.cardTitle}>{order.crop_name}</Text>
                <StatusChip label={order.status} />
              </View>
              <Text style={s.cardMeta}>{order.quantity} {order.unit} · ₹{order.total_price}</Text>
              <Text style={s.cardMeta}>Payment: {order.payment_status} · {order.payment_method}</Text>
              {order.tracking_code ? <Text style={s.cardMeta}>Tracking: {order.tracking_code}</Text> : null}
              {order.invoice_number ? <Text style={s.cardMeta}>Invoice: #{order.invoice_number}</Text> : null}
              {["Order Placed", "Order Confirmed"].includes(order.status) && (
                <Pressable style={[s.miniBtn, { backgroundColor: colors.red, marginTop: 8 }]} onPress={() => cancelOrder(order.id)}>
                  <Text style={[s.miniBtnText, { color: "#fff" }]}>Cancel Order</Text>
                </Pressable>
              )}
            </View>
          ))}
          {orders.history.length > 0 && <Text style={s.sectionHeading}>Order History</Text>}
          {orders.history.map((order: any) => (
            <View key={order.id} style={[s.listCard, { opacity: 0.82 }]}>
              <View style={s.rowBetween}>
                <Text style={s.cardTitle}>{order.crop_name}</Text>
                <StatusChip label={order.status} />
              </View>
              <Text style={s.cardMeta}>{order.quantity} {order.unit} · ₹{order.total_price}</Text>
              <Text style={s.cardMeta}>#{order.invoice_number}</Text>
            </View>
          ))}
          {orders.active.length === 0 && orders.history.length === 0 && !refreshing && (
            <EmptyState icon="receipt" text="No orders yet. Go to marketplace and buy!" />
          )}
        </ScrollView>
      )}

      {/* PROFILE TAB */}
      {tab === "profile" && (
        <ScrollView contentContainerStyle={s.page}>
          <Text style={s.pageTitle}>My Profile</Text>
          <View style={s.listCard}>
            <View style={[s.avatarCircle, { backgroundColor: colors.blue }]}>
              <FontAwesome6 name="user" size={28} color="#fff" />
            </View>
            <Text style={[s.cardTitle, { marginTop: 12 }]}>{user.full_name || user.username}</Text>
            <Text style={s.cardMeta}>{user.email}</Text>
            <Text style={s.cardMeta}>{[user.city, user.district, user.state, user.pincode].filter(Boolean).join(", ")}</Text>
          </View>
          <View style={s.listCard}>
            <Text style={s.sectionHeading}>Account Info</Text>
            <Text style={s.cardMeta}>Username: {user.username}</Text>
            <Text style={s.cardMeta}>Role: Customer</Text>
            <Text style={s.cardMeta}>Verified: {user.is_verified ? "Yes ✓" : "No"}</Text>
          </View>
          <BigBtn label="Logout" color={colors.red} onPress={logout} icon="right-from-bracket" />
        </ScrollView>
      )}

      <BottomNav
        tabs={[
          { key: "marketplace", icon: "store", label: "Market" },
          { key: "orders", icon: "receipt", label: "Orders" },
          { key: "profile", icon: "user", label: "Profile" },
        ]}
        active={tab}
        setActive={(k) => setTab(k as CustomerTab)}
      />

      {/* Razorpay Modal */}
      {rzpCheckoutData && (
        <RazorpayCheckoutModal
          visible={rzpModalVisible}
          data={rzpCheckoutData}
          onSuccess={handleRazorpaySuccess}
          onCancel={() => {
            setRzpModalVisible(false);
            setRzpCheckoutData(null);
            setPendingOrderId("");
          }}
          onError={(err) => {
            Alert.alert("Payment Error", err);
            setRzpModalVisible(false);
            setRzpCheckoutData(null);
            setPendingOrderId("");
          }}
        />
      )}
    </View>
  );
}

// ─── Shared Components ────────────────────────────────────────────────────────
function BottomNav({ tabs, active, setActive }: { tabs: { key: string; icon: string; label: string }[]; active: string; setActive: (k: string) => void }) {
  return (
    <View style={s.nav}>
      {tabs.map((item) => (
        <Pressable key={item.key} style={s.navItem} onPress={() => setActive(item.key)}>
          <FontAwesome6 color={active === item.key ? colors.green : "#8A918A"} name={item.icon as any} size={18} />
          <Text style={[s.navLabel, active === item.key && { color: colors.green, fontWeight: "700" }]}>{item.label}</Text>
        </Pressable>
      ))}
    </View>
  );
}

function StatusChip({ label, green: isGreen }: { label: string; green?: boolean }) {
  const isDelivered = label === "Delivered";
  const isConfirmed = label === "Order Confirmed" || label === "Verified";
  const isCancelled = label === "Cancelled";
  const isPending = label === "Order Placed" || label === "Pending";
  const bg = isDelivered || isConfirmed || isGreen ? colors.green : isCancelled ? colors.red : isPending ? colors.amber : colors.muted;
  return (
    <View style={[s.chip, { backgroundColor: bg }]}>
      <Text style={[s.chipText, { color: "#fff", fontSize: 11 }]}>{label}</Text>
    </View>
  );
}

function BigBtn({ label, onPress, color = colors.green, disabled = false, icon }: { label: string; onPress: () => void; color?: string; disabled?: boolean; icon?: string }) {
  return (
    <TouchableOpacity style={[s.bigBtn, { backgroundColor: color, opacity: disabled ? 0.6 : 1 }]} onPress={onPress} disabled={disabled} activeOpacity={0.82}>
      {icon ? <FontAwesome6 name={icon as any} size={16} color="#fff" style={{ marginRight: 8 }} /> : null}
      <Text style={s.bigBtnText}>{label}</Text>
    </TouchableOpacity>
  );
}

function EmptyState({ icon, text }: { icon: string; text: string }) {
  return (
    <View style={s.emptyState}>
      <FontAwesome6 name={icon as any} size={40} color={colors.border} />
      <Text style={s.emptyText}>{text}</Text>
    </View>
  );
}

function Splash({ darkMode }: { darkMode: boolean }) {
  const fade = useRef(new Animated.Value(0)).current;
  const rise = useRef(new Animated.Value(24)).current;
  const pulse = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    Animated.parallel([
      Animated.timing(fade, { toValue: 1, duration: 700, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
      Animated.timing(rise, { toValue: 0, duration: 700, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
    ]).start();
    const loop = Animated.loop(Animated.sequence([
      Animated.timing(pulse, { toValue: 1.035, duration: 1400, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
      Animated.timing(pulse, { toValue: 1, duration: 1400, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
    ]));
    loop.start();
    return () => loop.stop();
  }, [fade, pulse, rise]);
  return (
    <ImageBackground source={darkMode ? splashDarkBackground : splashLightBackground} resizeMode="cover" style={s.splash}>
      <View style={[s.overlay, darkMode ? s.overlayDark : s.overlayLight]} />
      <Animated.View style={[s.splashCard, { opacity: fade, transform: [{ translateY: rise }, { scale: pulse }] }]}>
        <Brand inverse={darkMode} />
      </Animated.View>
    </ImageBackground>
  );
}

function LoadingScreen({ darkMode }: { darkMode: boolean }) {
  const [dots, setDots] = useState(0);
  useEffect(() => { const t = setInterval(() => setDots((d) => (d + 1) % 4), 450); return () => clearInterval(t); }, []);
  return (
    <ImageBackground source={darkMode ? splashDarkBackground : splashLightBackground} resizeMode="cover" style={s.loadingScreen}>
      <View style={[s.overlay, darkMode ? s.overlayDark : s.overlayLight]} />
      <View style={s.loadingCard}>
        <Brand inverse={darkMode} compact />
        <ActivityIndicator color={darkMode ? "#F4F7EA" : colors.green} style={{ marginTop: 20, marginBottom: 12 }} />
        <Text style={[s.loadingTitle, darkMode && { color: "#F4F7EA" }]}>Loading{"." .repeat(dots)}</Text>
        <Text style={[s.cardMeta, { textAlign: "center", color: darkMode ? "rgba(244,247,234,0.82)" : colors.muted }]}>Preparing your farm workspace...</Text>
      </View>
    </ImageBackground>
  );
}

function LegacyAuthLayout(props: any) {
  const { authScreen, busy, error, forgot, login, notice, register, resetPassword, resetVerify, setAuthScreen, setForgot, setLogin, setRegister, setResetPassword, setResetVerify, setVerify, setTestOtp, submitForgot, submitResetPassword, submitResetVerify, submitVerify, testOtp, verify, resend } = props;
  return (
    <ScrollView contentContainerStyle={s.authWrap} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
      <View style={s.authHero}><Brand compact /><Text style={s.heroTitle}>Smart Farmer</Text><Text style={s.cardMeta}>Verify your email to continue</Text></View>
      {error ? <Notice tone="error" text={error} /> : null}
      {notice ? <Notice tone="info" text={notice} /> : null}
      {testOtp ? <Notice tone="otp" text={`Test OTP: ${testOtp}`} /> : null}
      <View style={s.card}>
        {authScreen === "verify" ? <>
          <Text style={s.sectionHeading}>Enter OTP</Text>
          <Field icon="envelope" label="Email"><TextInput autoCapitalize="none" keyboardType="email-address" onChangeText={(v) => setVerify((c: any) => ({ ...c, email: v }))} placeholder="name@example.com" placeholderTextColor="#8A938C" style={s.input} value={verify.email} /></Field>
          <Field icon="key" label="OTP"><TextInput keyboardType="number-pad" onChangeText={(v) => setVerify((c: any) => ({ ...c, otp: v }))} placeholder="6 digit code" placeholderTextColor="#8A938C" style={s.input} value={verify.otp} /></Field>
          <BigBtn disabled={Boolean(busy)} label={busy || "Verify and Login"} onPress={submitVerify} />
          <Text style={s.link} onPress={resend}>Resend OTP</Text>
          <Text style={s.link} onPress={() => { setTestOtp(""); setAuthScreen("login"); }}>Back to login</Text>
        </> : null}
        {authScreen === "forgot" ? <>
          <Text style={s.sectionHeading}>Forgot Password</Text>
          <Field icon="envelope" label="Email"><TextInput autoCapitalize="none" keyboardType="email-address" onChangeText={(v) => setForgot({ email: v })} placeholder="name@example.com" placeholderTextColor="#8A938C" style={s.input} value={forgot.email} /></Field>
          <BigBtn disabled={Boolean(busy)} label={busy || "Start Reset"} onPress={submitForgot} />
          <Text style={s.link} onPress={() => setAuthScreen("login")}>Back to login</Text>
        </> : null}
        {authScreen === "resetVerify" ? <>
          <Text style={s.sectionHeading}>Verify Reset OTP</Text>
          <Field icon="envelope" label="Email"><TextInput autoCapitalize="none" keyboardType="email-address" onChangeText={(v) => setResetVerify((c: any) => ({ ...c, email: v }))} placeholder="name@example.com" placeholderTextColor="#8A938C" style={s.input} value={resetVerify.email} /></Field>
          <Field icon="key" label="OTP"><TextInput keyboardType="number-pad" onChangeText={(v) => setResetVerify((c: any) => ({ ...c, otp: v }))} placeholder="6 digit code" placeholderTextColor="#8A938C" style={s.input} value={resetVerify.otp} /></Field>
          <BigBtn disabled={Boolean(busy)} label={busy || "Confirm OTP"} onPress={submitResetVerify} />
          <Text style={s.link} onPress={resend}>Resend OTP</Text>
        </> : null}
        {authScreen === "resetPassword" ? <>
          <Text style={s.sectionHeading}>New Password</Text>
          <Field icon="lock" label="New Password"><TextInput onChangeText={(v) => setResetPassword((c: any) => ({ ...c, password: v }))} placeholder="New password" placeholderTextColor="#8A938C" secureTextEntry style={s.input} value={resetPassword.password} /></Field>
          <Field icon="lock" label="Confirm"><TextInput onChangeText={(v) => setResetPassword((c: any) => ({ ...c, confirm_password: v }))} placeholder="Confirm" placeholderTextColor="#8A938C" secureTextEntry style={s.input} value={resetPassword.confirm_password} /></Field>
          <BigBtn disabled={Boolean(busy)} label={busy || "Update Password"} onPress={submitResetPassword} />
        </> : null}
      </View>
    </ScrollView>
  );
}

function Brand({ compact = false, inverse = false }: { compact?: boolean; inverse?: boolean }) {
  return (
    <View style={s.brand}>
      <View style={[s.logo, inverse && { backgroundColor: "#1F6A3A" }]}>
        <FontAwesome6 color="#FFFFFF" name="seedling" size={compact ? 16 : 20} />
      </View>
      <View>
        <Text style={[s.brandTitle, compact && { fontSize: 20 }, inverse && { color: "#F4F7EA" }]}>Smart Farmer</Text>
        <Text style={[s.brandMeta, inverse && { color: "rgba(244,247,234,0.78)" }]}>Soil to table network</Text>
      </View>
    </View>
  );
}

function Field({ icon, label, children }: { icon: React.ComponentProps<typeof FontAwesome6>["name"]; label: string; children: React.ReactNode }) {
  return <View style={{ marginBottom: 12 }}><Text style={s.fieldLabel}>{label}</Text><View style={s.fieldBox}><FontAwesome6 color={colors.dark} name={icon} size={16} />{children}</View></View>;
}

function Notice({ tone, text }: { tone: "error" | "info" | "otp"; text: string }) {
  return <View style={[s.notice, tone === "error" ? { backgroundColor: "#FBEAEA", borderColor: "#F3C5C1" } : tone === "otp" ? { backgroundColor: "#FFF2D8", borderColor: "#F0CF8E" } : { backgroundColor: "#EDF6EE", borderColor: "#CFE2D0" }]}><Text style={s.noticeText}>{text}</Text></View>;
}

function networkErrorMsg(): string {
  if (typeof window !== "undefined" && window.location?.protocol === "https:" && API_URL.startsWith("http://")) {
    return `Mixed Content Block: You opened the app over HTTPS (${window.location.host}), but the API is HTTP (${API_URL}). Please open http://localhost:8081 in your browser, or scan the QR code in Expo Go on your mobile device.`;
  }
  return `Unable to reach ${API_URL}. Ensure backend API is running (npm run dev:api) and EXPO_PUBLIC_API_URL is set in apps/mobile/.env for phone.`;
}

// ─── API Helpers ─────────────────────────────────────────────────────────────
async function apiRequest(path: string, body: Record<string, unknown>): Promise<ApiResult> {
  try {
    const url = `${API_URL}${path}`;
    const response = await fetch(url, { method: "POST", headers: { Accept: "application/json", "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const rawText = await response.text();
    let payload: Record<string, unknown> = {};
    try { payload = JSON.parse(rawText); } catch { /* ignore */ }
    const message = txt(payload.message) || `Request failed (${response.status}).`;
    return { ok: response.ok && Boolean(payload.success), message, payload };
  } catch {
    return { ok: false, message: networkErrorMsg(), payload: {} };
  }
}

async function authGet(path: string, token: string): Promise<ApiResult> {
  try {
    const response = await fetch(`${API_URL}${path}`, { method: "GET", headers: { Accept: "application/json", Authorization: `Token ${token}` } });
    const rawText = await response.text();
    let payload: Record<string, unknown> = {};
    try { payload = JSON.parse(rawText); } catch { /* ignore */ }
    const message = txt(payload.message) || `Request failed (${response.status}).`;
    return { ok: response.ok && Boolean(payload.success), message, payload };
  } catch {
    return { ok: false, message: networkErrorMsg(), payload: {} };
  }
}

async function authPost(path: string, body: Record<string, unknown>, token: string): Promise<ApiResult> {
  try {
    const response = await fetch(`${API_URL}${path}`, { method: "POST", headers: { Accept: "application/json", "Content-Type": "application/json", Authorization: `Token ${token}` }, body: JSON.stringify(body) });
    const rawText = await response.text();
    let payload: Record<string, unknown> = {};
    try { payload = JSON.parse(rawText); } catch { /* ignore */ }
    const message = txt(payload.message) || `Request failed (${response.status}).`;
    return { ok: response.ok && Boolean(payload.success), message, payload };
  } catch {
    return { ok: false, message: networkErrorMsg(), payload: {} };
  }
}

async function authPatch(path: string, body: Record<string, unknown>, token: string): Promise<ApiResult> {
  try {
    const response = await fetch(`${API_URL}${path}`, { method: "PATCH", headers: { Accept: "application/json", "Content-Type": "application/json", Authorization: `Token ${token}` }, body: JSON.stringify(body) });
    const rawText = await response.text();
    let payload: Record<string, unknown> = {};
    try { payload = JSON.parse(rawText); } catch { /* ignore */ }
    const message = txt(payload.message) || `Request failed (${response.status}).`;
    return { ok: response.ok && Boolean(payload.success), message, payload };
  } catch {
    return { ok: false, message: networkErrorMsg(), payload: {} };
  }
}

function txt(value: unknown): string {
  return value === undefined || value === null ? "" : String(value);
}

function isBlockedOtpEmail(email: string): boolean {
  const domain = email.trim().toLowerCase().split("@").pop() || "";
  return ["localhost", "invalid", "test", "test.com", "example.com", "example.org", "example.net"].includes(domain) || domain.endsWith(".invalid") || domain.endsWith(".local");
}

function asUser(value: unknown): User | null {
  if (!value || typeof value !== "object") return null;
  const r = value as Record<string, unknown>;
  return { id: txt(r.id), username: txt(r.username), email: txt(r.email), role: (txt(r.role) as UserRole) || "customer", full_name: txt(r.full_name), city: txt(r.city), state: txt(r.state), district: txt(r.district), pincode: txt(r.pincode), is_verified: Boolean(r.is_verified) };
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  splash: { flex: 1, justifyContent: "center", alignItems: "center", overflow: "hidden" },
  overlay: { ...StyleSheet.absoluteFillObject },
  overlayDark: { backgroundColor: "rgba(4,10,7,0.34)" },
  overlayLight: { backgroundColor: "rgba(22,37,18,0.24)" },
  splashCard: { paddingHorizontal: 24, paddingVertical: 20, borderRadius: 28, backgroundColor: "rgba(246,250,241,0.90)", borderWidth: 1, borderColor: "rgba(255,255,255,0.45)", shadowColor: "#0D1D12", shadowOpacity: 0.22, shadowRadius: 26, shadowOffset: { width: 0, height: 10 } },
  loadingScreen: { flex: 1, justifyContent: "center", alignItems: "center", overflow: "hidden" },
  loadingCard: { paddingHorizontal: 24, paddingVertical: 26, borderRadius: 28, backgroundColor: "rgba(246,250,241,0.90)", borderWidth: 1, borderColor: "rgba(255,255,255,0.45)", shadowColor: "#0D1D12", shadowOpacity: 0.22, shadowRadius: 26, shadowOffset: { width: 0, height: 10 }, alignItems: "center", minWidth: 280 },
  loadingTitle: { color: colors.dark, fontSize: 20, fontWeight: "800", marginBottom: 6 },
  authWrap: { padding: 18, paddingBottom: 36 },
  authHero: { backgroundColor: colors.soft, borderRadius: 28, padding: 20, marginBottom: 14, borderWidth: 1, borderColor: "#D5E7D5" },
  heroTitle: { fontSize: 28, fontWeight: "800", color: colors.text, marginTop: 16, marginBottom: 6 },
  card: { backgroundColor: colors.card, borderRadius: 24, padding: 18, borderWidth: 1, borderColor: colors.border },
  page: { padding: 16, paddingBottom: 110 },
  pageTitle: { fontSize: 26, fontWeight: "800", color: colors.dark, marginBottom: 4 },
  pageSub: { fontSize: 14, color: colors.muted, marginBottom: 16 },
  sectionHeading: { fontSize: 17, fontWeight: "700", color: colors.dark, marginBottom: 10, marginTop: 6 },
  listCard: { backgroundColor: colors.card, borderRadius: 18, padding: 16, borderWidth: 1, borderColor: colors.border, marginBottom: 12 },
  cardTitle: { fontSize: 16, fontWeight: "700", color: colors.dark },
  cardMeta: { fontSize: 13, color: colors.muted, marginTop: 3, lineHeight: 19 },
  row: { flexDirection: "row", gap: 8, flexWrap: "wrap" },
  rowBetween: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", gap: 8 },
  chip: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 10, backgroundColor: colors.muted },
  chipText: { color: "#fff", fontWeight: "700", fontSize: 12 },
  nav: { position: "absolute", left: 12, right: 12, bottom: 12, flexDirection: "row", backgroundColor: "rgba(255,255,255,0.97)", borderRadius: 22, paddingVertical: 10, paddingHorizontal: 8, borderWidth: 1, borderColor: colors.border, shadowColor: "#000", shadowOpacity: 0.08, shadowRadius: 12, shadowOffset: { width: 0, height: 4 } },
  navItem: { flex: 1, alignItems: "center", gap: 4 },
  navLabel: { fontSize: 11, color: "#8A918A" },
  roleHeader: { marginBottom: 16 },
  roleBadge: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8, alignSelf: "flex-start", marginBottom: 8 },
  roleBadgeText: { color: "#fff", fontSize: 11, fontWeight: "800", letterSpacing: 1.2 },
  statsGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10, marginBottom: 16 },
  statCard: { flex: 1, minWidth: "44%", backgroundColor: colors.card, borderRadius: 14, padding: 14, borderWidth: 1, borderColor: colors.border, borderLeftWidth: 4, gap: 4 },
  statValue: { fontSize: 22, fontWeight: "800" },
  statLabel: { fontSize: 12, color: colors.muted },
  miniBtn: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 10, backgroundColor: "#E8EBE7" },
  miniBtnText: { fontSize: 12, fontWeight: "700", color: colors.dark },
  bigBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", borderRadius: 14, paddingVertical: 15, marginTop: 10, marginBottom: 4 },
  bigBtnText: { color: "#fff", fontSize: 15, fontWeight: "700" },
  fieldLabel: { fontSize: 13, fontWeight: "700", color: colors.dark, marginBottom: 6 },
  fieldBox: { minHeight: 52, borderWidth: 1, borderColor: colors.border, borderRadius: 14, paddingHorizontal: 14, backgroundColor: "#FBFCF8", flexDirection: "row", alignItems: "center", gap: 10 },
  input: { flex: 1, color: colors.text, fontSize: 15, paddingVertical: 14 },
  link: { color: colors.text, fontSize: 14, marginBottom: 10, textAlign: "center" },
  notice: { borderWidth: 1, borderRadius: 14, paddingHorizontal: 14, paddingVertical: 12, marginBottom: 12 },
  noticeText: { color: colors.text, fontSize: 13, lineHeight: 19 },
  brand: { flexDirection: "row", alignItems: "center", gap: 12 },
  logo: { width: 44, height: 44, borderRadius: 16, backgroundColor: colors.green, alignItems: "center", justifyContent: "center" },
  brandTitle: { color: colors.dark, fontSize: 22, fontWeight: "700" },
  brandMeta: { color: "rgba(31,106,58,0.70)", fontSize: 10, fontWeight: "700", textTransform: "uppercase", letterSpacing: 2.1 },
  avatarCircle: { width: 72, height: 72, borderRadius: 36, alignItems: "center", justifyContent: "center", alignSelf: "center" },
  searchBox: { flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, borderRadius: 14, paddingHorizontal: 14, paddingVertical: 12, marginBottom: 14 },
  searchInput: { flex: 1, color: colors.text, fontSize: 15 },
  tag: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8, backgroundColor: "#E8EBE7" },
  tagText: { fontSize: 12, color: colors.dark, fontWeight: "600" },
  qtyRow: { flexDirection: "row", alignItems: "center", gap: 16, marginTop: 6 },
  qtyBtn: { width: 36, height: 36, borderRadius: 10, backgroundColor: colors.soft, alignItems: "center", justifyContent: "center" },
  qtyText: { fontSize: 20, fontWeight: "800", color: colors.dark, minWidth: 36, textAlign: "center" },
  totalRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: 12, borderTopWidth: 1, borderTopColor: colors.border, marginTop: 8 },
  totalLabel: { fontSize: 15, fontWeight: "700", color: colors.dark },
  totalValue: { fontSize: 22, fontWeight: "800", color: colors.green },
  payMethodRow: { flexDirection: "row", gap: 8, marginTop: 6, marginBottom: 10 },
  payMethodBtn: { flex: 1, flexDirection: "column", alignItems: "center", gap: 6, paddingVertical: 12, borderRadius: 14, backgroundColor: colors.soft, borderWidth: 1, borderColor: colors.border },
  payMethodBtnActive: { backgroundColor: colors.green, borderColor: colors.green },
  payMethodText: { fontSize: 11, fontWeight: "700", color: colors.dark, textAlign: "center" },
  payMethodTextActive: { color: "#fff" },
  payInfoBox: { flexDirection: "row", alignItems: "flex-start", gap: 10, backgroundColor: colors.soft, borderRadius: 12, padding: 12, marginBottom: 8 },
  payInfoText: { flex: 1, fontSize: 13, color: colors.dark, lineHeight: 19 },
  successBanner: { flexDirection: "row", alignItems: "center", backgroundColor: colors.green, paddingHorizontal: 16, paddingVertical: 12 },
  successTitle: { color: "#fff", fontWeight: "700", fontSize: 14 },
  successSub: { color: "rgba(255,255,255,0.85)", fontSize: 12 },
  emptyState: { alignItems: "center", paddingVertical: 40, gap: 12 },
  emptyText: { fontSize: 15, color: colors.muted, textAlign: "center" },
});
