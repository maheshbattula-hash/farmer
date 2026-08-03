import React, { useEffect, useMemo, useRef, useState } from "react";
import { KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { Feather, FontAwesome6, MaterialCommunityIcons } from "@expo/vector-icons";

type AuthTab = "login" | "register";
type FeedbackTone = "success" | "error" | "info";
type LoginState = { email: string; password: string };
type RegisterState = { username: string; email: string; password: string; full_name: string; city: string; state: string; district: string; pincode: string; role: string; gender?: string };
type VerificationPurpose = "email_verification" | "signup_email_verification";
type VerificationResult = { ok: boolean; message: string; challengeId?: string; email?: string; otp?: string | null; purpose?: VerificationPurpose | string };
type SimpleResult = { ok: boolean; message: string; otp?: string | null };
type VerificationTarget = "login" | "register";

type Props = {
  authScreen: AuthTab;
  busy: string;
  login: LoginState;
  register: RegisterState;
  setAuthScreen: (screen: "login" | "register" | "forgot") => void;
  setLogin: React.Dispatch<React.SetStateAction<LoginState>>;
  setRegister: React.Dispatch<React.SetStateAction<RegisterState>>;
  onStartEmailVerification: (email: string, target: VerificationTarget) => Promise<VerificationResult>;
  onCompleteEmailVerification: (params: { challengeId: string; email: string; otp: string; purpose: VerificationPurpose }) => Promise<SimpleResult>;
  onLogin: (params: { challengeId: string; email: string; password: string }) => Promise<SimpleResult>;
  onRegister: (payload: RegisterState) => Promise<SimpleResult>;
};

type Feedback = { tone: FeedbackTone; text: string } | null;
type LanguageCode = "EN" | "TE" | "TA" | "HI" | "KN" | "ML";
type TranslationKey =
  | "welcomeBack"
  | "createAccount"
  | "verifyEmailThenLogin"
  | "stepByStepSignup"
  | "login"
  | "signup"
  | "email"
  | "password"
  | "fullName"
  | "username"
  | "gender"
  | "role"
  | "male"
  | "female"
  | "other"
  | "customer"
  | "farmer"
  | "rememberMe"
  | "forgot"
  | "verified"
  | "verify"
  | "personal"
  | "security"
  | "location"
  | "personalDetails"
  | "enterBasicInfo"
  | "emailAndPassword"
  | "setEmailAndPassword"
  | "geographicalDetails"
  | "addLocationInfo"
  | "city"
  | "state"
  | "district"
  | "pincode"
  | "back"
  | "continue"
  | "createAccountButton"
  | "noAccount"
  | "alreadyHaveOne"
  | "signUpAction"
  | "loginAction";

const BRAND_GREEN = "#1F7A45";
const TEXT_DARK = "#173927";
const TEXT_MUTED = "#6A766E";
const BORDER_LIGHT = "#E4EAE5";
const CARD_BG = "rgba(255,255,255,0.92)";
const SURFACE_SOFT = "#F8FBF8";
const SURFACE_ALT = "#EEF3EF";
const OTP_RESEND_SECONDS = 30;
const LANGUAGE_OPTIONS: Array<{ code: LanguageCode; label: string }> = [
  { code: "EN", label: "English" },
  { code: "TE", label: "\u0c24\u0c46\u0c32\u0c41\u0c17\u0c41" },
  { code: "TA", label: "\u0ba4\u0bae\u0bbf\u0bb4\u0bcd" },
  { code: "HI", label: "Hindi" },
  { code: "KN", label: "\u0c95\u0ca8\u0ccd\u0ca8\u0ca1" },
  { code: "ML", label: "\u0d2e\u0d32\u0d2f\u0d3e\u0d33\u0d02" },
];
const AUTH_COPY: Record<LanguageCode, Partial<Record<TranslationKey, string>>> = {
  EN: {
    welcomeBack: "Welcome back",
    createAccount: "Create account",
    verifyEmailThenLogin: "Verify email, then login",
    stepByStepSignup: "Step by step signup",
    login: "login",
    signup: "signup",
    email: "Email",
    password: "Password",
    fullName: "Full name",
    username: "Username",
    gender: "Gender",
    role: "Role",
    male: "Male",
    female: "Female",
    other: "Other",
    customer: "Customer",
    farmer: "Farmer",
    rememberMe: "Remember me",
    forgot: "Forgot?",
    verified: "Verified",
    verify: "Verify",
    personal: "Personal",
    security: "Security",
    location: "Location",
    personalDetails: "Personal details",
    enterBasicInfo: "Enter your basic information first.",
    emailAndPassword: "Email & password",
    setEmailAndPassword: "Set your email and password.",
    geographicalDetails: "Geographical details",
    addLocationInfo: "Add your location information to finish signup.",
    city: "City",
    state: "State",
    district: "District",
    pincode: "Pincode",
    back: "Back",
    continue: "Continue",
    createAccountButton: "Create account",
    noAccount: "No account?",
    alreadyHaveOne: "Already have one?",
    signUpAction: "Sign up",
    loginAction: "Login",
  },
  HI: {
    welcomeBack: "\u0935\u093e\u092a\u0938 \u0938\u094d\u0935\u093e\u0917\u0924 \u0939\u0948",
    createAccount: "\u0916\u093e\u0924\u093e \u092c\u0928\u093e\u090f\u0901",
    verifyEmailThenLogin: "\u092a\u0939\u0932\u0947 \u0908\u092e\u0947\u0932 \u0938\u0924\u094d\u092f\u093e\u092a\u093f\u0924 \u0915\u0930\u0947\u0902, \u092b\u093f\u0930 \u0932\u0949\u0917\u093f\u0928 \u0915\u0930\u0947\u0902",
    stepByStepSignup: "\u091a\u0930\u0923-\u0926\u0930-\u091a\u0930\u0923 \u0938\u093e\u0907\u0928\u0905\u092a",
    login: "\u0932\u0949\u0917\u093f\u0928",
    signup: "\u0938\u093e\u0907\u0928 \u0905\u092a",
    email: "\u0908\u092e\u0947\u0932",
    password: "\u092a\u093e\u0938\u0935\u0930\u094d\u0921",
    fullName: "\u092a\u0942\u0930\u093e \u0928\u093e\u092e",
    username: "\u092f\u0942\u091c\u0930\u0928\u0947\u092e",
    gender: "\u0932\u093f\u0902\u0917",
    role: "\u092d\u0942\u092e\u093f\u0915\u093e",
    male: "\u092a\u0941\u0930\u0941\u0937",
    female: "\u092e\u0939\u093f\u0932\u093e",
    other: "\u0905\u0928\u094d\u092f",
    customer: "\u0917\u094d\u0930\u093e\u0939\u0915",
    farmer: "\u0915\u093f\u0938\u093e\u0928",
    rememberMe: "\u092e\u0941\u091d\u0947 \u092f\u093e\u0926 \u0930\u0916\u0947\u0902",
    forgot: "\u092d\u0942\u0932 \u0917\u090f?",
    verified: "\u0938\u0924\u094d\u092f\u093e\u092a\u093f\u0924",
    verify: "\u0938\u0924\u094d\u092f\u093e\u092a\u093f\u0924 \u0915\u0930\u0947\u0902",
    personal: "\u0935\u094d\u092f\u0915\u094d\u0924\u093f\u0917\u0924",
    security: "\u0938\u0941\u0930\u0915\u094d\u0937\u093e",
    location: "\u0938\u094d\u0925\u093e\u0928",
    personalDetails: "\u0935\u094d\u092f\u0915\u094d\u0924\u093f\u0917\u0924 \u0935\u093f\u0935\u0930\u0923",
    enterBasicInfo: "\u092a\u0939\u0932\u0947 \u0905\u092a\u0928\u0940 \u092c\u0941\u0928\u093f\u092f\u093e\u0926\u0940 \u091c\u093e\u0928\u0915\u093e\u0930\u0940 \u0926\u0930\u094d\u091c \u0915\u0930\u0947\u0902।",
    emailAndPassword: "\u0908\u092e\u0947\u0932 \u0914\u0930 \u092a\u093e\u0938\u0935\u0930\u094d\u0921",
    setEmailAndPassword: "\u0905\u092a\u0928\u093e \u0908\u092e\u0947\u0932 \u0914\u0930 \u092a\u093e\u0938\u0935\u0930\u094d\u0921 \u0938\u0947\u091f \u0915\u0930\u0947\u0902।",
    geographicalDetails: "\u0938\u094d\u0925\u093e\u0928 \u0935\u093f\u0935\u0930\u0923",
    addLocationInfo: "\u0938\u093e\u0907\u0928\u0905\u092a \u092a\u0942\u0930\u093e \u0915\u0930\u0928\u0947 \u0915\u0947 \u0932\u093f\u090f \u0905\u092a\u0928\u0940 \u0932\u094b\u0915\u0947\u0936\u0928 \u091c\u094b\u0921\u093c\u0947\u0902।",
    city: "\u0936\u0939\u0930",
    state: "\u0930\u093e\u091c\u094d\u092f",
    district: "\u091c\u093f\u0932\u093e",
    pincode: "\u092a\u093f\u0928\u0915\u094b\u0921",
    back: "\u092a\u0940\u091b\u0947",
    continue: "\u091c\u093e\u0930\u0940 \u0930\u0916\u0947\u0902",
    createAccountButton: "\u0916\u093e\u0924\u093e \u092c\u0928\u093e\u090f\u0901",
    noAccount: "\u0916\u093e\u0924\u093e \u0928\u0939\u0940\u0902 \u0939\u0948?",
    alreadyHaveOne: "\u092a\u0939\u0932\u0947 \u0938\u0947 \u0916\u093e\u0924\u093e \u0939\u0948?",
    signUpAction: "\u0938\u093e\u0907\u0928 \u0905\u092a",
    loginAction: "\u0932\u0949\u0917\u093f\u0928",
  },
  TE: {
    welcomeBack: "\u0c24\u0c3f\u0c30\u0c3f\u0c17\u0c3f \u0c38\u0c4d\u0c35\u0c3e\u0c17\u0c24\u0c02",
    createAccount: "\u0c16\u0c3e\u0c24\u0c3e \u0c38\u0c43\u0c37\u0c4d\u0c1f\u0c3f\u0c02\u0c1a\u0c02\u0c21\u0c3f",
    verifyEmailThenLogin: "\u0c2e\u0c41\u0c02\u0c26\u0c41 \u0c08\u0c2e\u0c46\u0c2f\u0c3f\u0c32\u0c4d \u0c27\u0c43\u0c35\u0c40\u0c15\u0c30\u0c3f\u0c02\u0c1a\u0c3f, \u0c24\u0c30\u0c4d\u0c35\u0c3e\u0c24 \u0c32\u0c3e\u0c17\u0c3f\u0c28\u0c4d \u0c05\u0c35\u0c02\u0c21\u0c3f",
    stepByStepSignup: "\u0c26\u0c36\u0c32 \u0c35\u0c3e\u0c30\u0c40 \u0c38\u0c48\u0c28\u0c4d\u0c05\u0c2a\u0c4d",
    login: "\u0c32\u0c3e\u0c17\u0c3f\u0c28\u0c4d",
    signup: "\u0c38\u0c48\u0c28\u0c4d \u0c05\u0c2a\u0c4d",
    email: "\u0c08\u0c2e\u0c46\u0c2f\u0c3f\u0c32\u0c4d",
    password: "\u0c2a\u0c3e\u0c38\u0c4d\u0c35\u0c30\u0c4d\u0c21\u0c4d",
    fullName: "\u0c2a\u0c42\u0c30\u0c4d\u0c24\u0c3f \u0c2a\u0c47\u0c30\u0c41",
    username: "\u0c2f\u0c42\u0c1c\u0c30\u0c4d\u0c28\u0c47\u0c2e\u0c4d",
    gender: "\u0c32\u0c3f\u0c02\u0c17\u0c02",
    role: "\u0c2a\u0c3e\u0c24\u0c4d\u0c30",
    male: "\u0c2a\u0c41\u0c30\u0c41\u0c37\u0c41\u0c21\u0c41",
    female: "\u0c2e\u0c39\u0c3f\u0c33",
    other: "\u0c07\u0c24\u0c30",
    customer: "\u0c17\u0c4d\u0c30\u0c3e\u0c39\u0c15\u0c41\u0c21\u0c41",
    farmer: "\u0c30\u0c48\u0c24\u0c41",
    rememberMe: "\u0c28\u0c28\u0c4d\u0c28\u0c41 \u0c17\u0c41\u0c30\u0c4d\u0c24\u0c41\u0c02\u0c1a\u0c41\u0c15\u0c4b\u0c02\u0c21\u0c3f",
    forgot: "\u0c2e\u0c30\u0c1a\u0c3f\u0c2a\u0c4b\u0c2f\u0c3e\u0c30\u0c3e?",
    verified: "\u0c27\u0c43\u0c35\u0c40\u0c15\u0c30\u0c3f\u0c02\u0c1a\u0c2c\u0c21\u0c3f\u0c02\u0c26\u0c3f",
    verify: "\u0c27\u0c43\u0c35\u0c40\u0c15\u0c30\u0c3f\u0c02\u0c1a\u0c02\u0c21\u0c3f",
    personal: "\u0c35\u0c4d\u0c2f\u0c15\u0c4d\u0c24\u0c3f\u0c17\u0c24",
    security: "\u0c2d\u0c26\u0c4d\u0c30\u0c24",
    location: "\u0c2a\u0c4d\u0c30\u0c26\u0c47\u0c36\u0c02",
    personalDetails: "\u0c35\u0c4d\u0c2f\u0c15\u0c4d\u0c24\u0c3f\u0c17\u0c24 \u0c35\u0c3f\u0c35\u0c30\u0c3e\u0c32\u0c41",
    enterBasicInfo: "\u0c2e\u0c41\u0c02\u0c26\u0c41 \u0c2e\u0c40 \u0c2a\u0c4d\u0c30\u0c3e\u0c25\u0c2e\u0c3f\u0c15 \u0c38\u0c2e\u0c3e\u0c1a\u0c3e\u0c30\u0c02 \u0c07\u0c35\u0c4d\u0c35\u0c02\u0c21\u0c3f\u0c2f\u0c02\u0c21\u0c3f.",
    emailAndPassword: "\u0c08\u0c2e\u0c46\u0c2f\u0c3f\u0c32\u0c4d & \u0c2a\u0c3e\u0c38\u0c4d\u0c35\u0c30\u0c4d\u0c21\u0c4d",
    setEmailAndPassword: "\u0c2e\u0c40 \u0c08\u0c2e\u0c46\u0c2f\u0c3f\u0c32\u0c4d \u0c2e\u0c30\u0c3f\u0c2f\u0c41 \u0c2a\u0c3e\u0c38\u0c4d\u0c35\u0c30\u0c4d\u0c21\u0c4d \u0c38\u0c46\u0c1f\u0c4d \u0c1a\u0c47\u0c2f\u0c02\u0c21\u0c3f.",
    geographicalDetails: "\u0c2a\u0c4d\u0c30\u0c26\u0c47\u0c36 \u0c35\u0c3f\u0c35\u0c30\u0c3e\u0c32\u0c41",
    addLocationInfo: "\u0c38\u0c48\u0c28\u0c4d\u0c05\u0c2a\u0c4d \u0c2a\u0c42\u0c30\u0c4d\u0c24\u0c3f \u0c1a\u0c47\u0c2f\u0c21\u0c3e\u0c28\u0c3f\u0c15\u0c3f \u0c2e\u0c40 \u0c32\u0c4a\u0c15\u0c47\u0c37\u0c28\u0c4d \u0c35\u0c3f\u0c35\u0c30\u0c3e\u0c32\u0c41 \u0c1c\u0c4b\u0c21\u0c3f\u0c02\u0c1a\u0c02\u0c21\u0c3f.",
    city: "\u0c28\u0c17\u0c30\u0c02",
    state: "\u0c30\u0c3e\u0c37\u0c4d\u0c1f\u0c4d\u0c30\u0c02",
    district: "\u0c1c\u0c3f\u0c32\u0c4d\u0c32\u0c3e",
    pincode: "\u0c2a\u0c3f\u0c28\u0c4d\u0c15\u0c4b\u0c21\u0c4d",
    back: "\u0c35\u0c46\u0c28\u0c15\u0c4d\u0c15\u0c3f",
    continue: "\u0c15\u0c4a\u0c28\u0c38\u0c3e\u0c17\u0c3f\u0c02\u0c1a\u0c02\u0c21\u0c3f",
    createAccountButton: "\u0c16\u0c3e\u0c24\u0c3e \u0c38\u0c43\u0c37\u0c4d\u0c1f\u0c3f\u0c02\u0c1a\u0c02\u0c21\u0c3f",
    noAccount: "\u0c16\u0c3e\u0c24\u0c3e \u0c32\u0c47\u0c26\u0c3e?",
    alreadyHaveOne: "\u0c07\u0c2a\u0c4d\u0c2a\u0c1f\u0c3f\u0c15\u0c47 \u0c12\u0c15\u0c1f\u0c3f \u0c09\u0c02\u0c26\u0c3e?",
    signUpAction: "\u0c38\u0c48\u0c28\u0c4d \u0c05\u0c2a\u0c4d",
    loginAction: "\u0c32\u0c3e\u0c17\u0c3f\u0c28\u0c4d",
  },
  TA: {
    welcomeBack: "\u0bae\u0bc0\u0ba3\u0bcd\u0b9f\u0bc1\u0bae\u0bcd \u0bb5\u0bb0\u0bb5\u0bc7\u0bb1\u0bcd\u0b95\u0bbf\u0bb1\u0bcb\u0bae\u0bcd",
    createAccount: "\u0b95\u0ba3\u0b95\u0bcd\u0b95\u0bc8 \u0b89\u0bb0\u0bc1\u0bb5\u0bbe\u0b95\u0bcd\u0b95\u0bb5\u0bc1\u0bae\u0bcd",
    verifyEmailThenLogin: "\u0bae\u0bc1\u0ba4\u0bb2\u0bbf\u0bb2\u0bcd \u0bae\u0bbf\u0ba9\u0bcd\u0ba9\u0b9e\u0bcd\u0b9a\u0bb2\u0bc8 \u0b9a\u0bb0\u0bbf\u0baa\u0bbe\u0bb0\u0bcd\u0ba4\u0bcd\u0ba4\u0bc1, \u0baa\u0bbf\u0ba9\u0bcd\u0ba9\u0bb0\u0bcd \u0b89\u0bb3\u0bcd\u0ba8\u0bc1\u0bb4\u0bc8\u0baf\u0bb5\u0bc1\u0bae\u0bcd",
    stepByStepSignup: "\u0baa\u0b9f\u0bbf\u0baa\u0bcd\u0baa\u0b9f\u0bbf\u0baf\u0bbe\u0ba9 \u0baa\u0ba4\u0bbf\u0bb5\u0bc1",
    login: "\u0b89\u0bb3\u0bcd\u0ba8\u0bc1\u0bb4\u0bc8\u0bb5\u0bc1",
    signup: "\u0baa\u0ba4\u0bbf\u0bb5\u0bc1",
    email: "\u0bae\u0bbf\u0ba9\u0bcd\u0ba9\u0b9e\u0bcd\u0b9a\u0bb2\u0bcd",
    password: "\u0b95\u0b5f\u0b35\u0bc1\u0b9a\u0bcd\u0b9a\u0bca\u0bb2\u0bcd",
    fullName: "\u0bae\u0bc1\u0bb4\u0bc1 \u0baa\u0bc6\u0baf\u0bb0\u0bcd",
    username: "\u0baa\u0baf\u0ba9\u0bb0\u0bcd\u0baa\u0bc6\u0baf\u0bb0\u0bcd",
    gender: "\u0baa\u0bbe\u0bb2\u0bbf\u0ba9\u0bae\u0bcd",
    role: "\u0baa\u0b99\u0bcd\u0b95\u0bc1",
    male: "\u0b86\u0ba3\u0bcd",
    female: "\u0baa\u0bc6\u0ba3\u0bcd",
    other: "\u0baa\u0bbf\u0bb1",
    customer: "\u0bb5\u0bbe\u0b9f\u0bbf\u0b95\u0bcd\u0b95\u0bc8\u0baf\u0bbe\u0bb3\u0bb0\u0bcd",
    farmer: "\u0bb5\u0bbf\u0bb5\u0b9a\u0bbe\u0baf\u0bbf",
    rememberMe: "\u0b8e\u0ba9\u0bcd\u0ba9\u0bc8 \u0ba8\u0bbf\u0ba9\u0bc8\u0bb5\u0bbf\u0bb2\u0bcd \u0bb5\u0bc8\u0b95\u0bcd\u0b95\u0bb5\u0bc1\u0bae\u0bcd",
    forgot: "\u0bae\u0bb1\u0ba8\u0bcd\u0ba4\u0bc1\u0bb5\u0bbf\u0b9f\u0bcd\u0b9f\u0bc0\u0bb0\u0bcd\u0b95\u0bb3\u0bbe?",
    verified: "\u0b9a\u0bb0\u0bbf\u0baa\u0bbe\u0bb0\u0bcd\u0b95\u0bcd\u0b95\u0baa\u0bcd\u0baa\u0b9f\u0bcd\u0b9f\u0ba4\u0bc1",
    verify: "\u0b9a\u0bb0\u0bbf\u0baa\u0bbe\u0bb0\u0bcd",
    personal: "\u0ba4\u0ba9\u0bbf\u0baa\u0bcd\u0baa\u0b9f\u0bcd\u0b9f",
    security: "\u0baa\u0bbe\u0ba4\u0bc1\u0b95\u0bbe\u0baa\u0bcd\u0baa\u0bc1",
    location: "\u0b87\u0b9f\u0bae\u0bcd",
    personalDetails: "\u0ba4\u0ba9\u0bbf\u0baa\u0bcd\u0baa\u0b9f\u0bcd\u0b9f \u0bb5\u0bbf\u0bb5\u0bb0\u0b99\u0bcd\u0b95\u0bb3\u0bcd",
    enterBasicInfo: "\u0bae\u0bc1\u0ba4\u0bb2\u0bbf\u0bb2\u0bcd \u0b89\u0b99\u0bcd\u0b95\u0bb3\u0bcd \u0b85\u0b9f\u0bbf\u0baa\u0bcd\u0baa\u0b9f\u0bc8 \u0ba4\u0b95\u0bb5\u0bb2\u0bcd\u0b95\u0bb3\u0bc8 \u0b89\u0bb3\u0bcd\u0bb3\u0bbf\u0b9f\u0bb5\u0bc1\u0bae\u0bcd.",
    emailAndPassword: "\u0bae\u0bbf\u0ba9\u0bcd\u0ba9\u0b9e\u0bcd\u0b9a\u0bb2\u0bcd \u0bae\u0bb1\u0bcd\u0bb1\u0bc1\u0bae\u0bcd \u0b95\u0b5f\u0b35\u0bc1\u0b9a\u0bcd\u0b9a\u0bca\u0bb2\u0bcd",
    setEmailAndPassword: "\u0b89\u0b99\u0bcd\u0b95\u0bb3\u0bcd \u0bae\u0bbf\u0ba9\u0bcd\u0ba9\u0b9e\u0bcd\u0b9a\u0bb2\u0bcd \u0bae\u0bb1\u0bcd\u0bb1\u0bc1\u0bae\u0bcd \u0b95\u0b5f\u0b35\u0bc1\u0b9a\u0bcd\u0b9a\u0bca\u0bb2\u0bcd\u0bb2\u0bc8 \u0b85\u0bae\u0bc8\u0b95\u0bcd\u0b95\u0bb5\u0bc1\u0bae\u0bcd.",
    geographicalDetails: "\u0b87\u0b9f \u0bb5\u0bbf\u0bb5\u0bb0\u0b99\u0bcd\u0b95\u0bb3\u0bcd",
    addLocationInfo: "\u0baa\u0ba4\u0bbf\u0bb5\u0bc8 \u0bae\u0bc1\u0b9f\u0bbf\u0b95\u0bcd\u0b95 \u0b89\u0b99\u0bcd\u0b95\u0bb3\u0bcd \u0b87\u0b9f \u0ba4\u0b95\u0bb5\u0bb2\u0bcd\u0b95\u0bb3\u0bc8 \u0b9a\u0bc7\u0bb0\u0bcd\u0b95\u0bcd\u0b95\u0bb5\u0bc1\u0bae\u0bcd.",
    city: "\u0ba8\u0b95\u0bb0\u0bae\u0bcd",
    state: "\u0bae\u0bbe\u0ba8\u0bbf\u0bb2\u0bae\u0bcd",
    district: "\u0bae\u0bbe\u0bb5\u0b9f\u0bcd\u0b9f\u0bae\u0bcd",
    pincode: "\u0baa\u0bbf\u0ba9\u0bcd\u0b95\u0bcb\u0b9f\u0bcd",
    back: "\u0baa\u0bbf\u0ba9\u0bcd",
    continue: "\u0ba4\u0bca\u0b9f\u0bb0\u0bb5\u0bc1\u0bae\u0bcd",
    createAccountButton: "\u0b95\u0ba3\u0b95\u0bcd\u0b95\u0bc8 \u0b89\u0bb0\u0bc1\u0bb5\u0bbe\u0b95\u0bcd\u0b95\u0bb5\u0bc1\u0bae\u0bcd",
    noAccount: "\u0b95\u0ba3\u0b95\u0bcd\u0b95\u0bc1 \u0b87\u0bb2\u0bcd\u0bb2\u0bc8\u0baf\u0bbe?",
    alreadyHaveOne: "\u0b8f\u0bb1\u0bcd\u0b95\u0ba9\u0bb5\u0bc7 \u0b92\u0ba9\u0bcd\u0bb1\u0bc1 \u0b89\u0bb3\u0bcd\u0bb3\u0ba4\u0bbe?",
    signUpAction: "\u0baa\u0ba4\u0bbf\u0bb5\u0bc1",
    loginAction: "\u0b89\u0bb3\u0bcd\u0ba8\u0bc1\u0bb4\u0bc8\u0bb5\u0bc1",
  },
  KN: {
    welcomeBack: "\u0cae\u0ca4\u0ccd\u0ca4\u0cc6 \u0cb8\u0ccd\u0cb5\u0cbe\u0c97\u0ca4",
    createAccount: "\u0c96\u0cbe\u0ca4\u0cc6 \u0cb8\u0cc3\u0cb7\u0ccd\u0c9f\u0cbf\u0cb8\u0cbf",
    verifyEmailThenLogin: "\u0cae\u0cca\u0ca6\u0cb2\u0cc1 \u0c88\u0cae\u0cc7\u0cb2\u0ccd \u0cb8\u0ca4\u0ccd\u0caf\u0cbe\u0caa\u0cbf\u0cb8\u0cbf, \u0ca8\u0c82\u0ca4\u0cb0 \u0cb2\u0cbe\u0c97\u0cbf\u0ca8\u0ccd \u0cae\u0cbe\u0ca1\u0cbf",
    stepByStepSignup: "\u0cb9\u0c82\u0ca4 \u0cb9\u0c82\u0ca4\u0cb5\u0cbe\u0c97\u0cbf \u0cb8\u0cc8\u0ca8\u0ccd \u0c85\u0caa\u0ccd",
    login: "\u0cb2\u0cbe\u0c97\u0cbf\u0ca8\u0ccd",
    signup: "\u0cb8\u0cc8\u0ca8\u0ccd \u0c85\u0caa\u0ccd",
    email: "\u0c88\u0cae\u0cc7\u0cb2\u0ccd",
    password: "\u0caa\u0cbe\u0cb8\u0ccd\u0cb5\u0cb0\u0ccd\u0ca1\u0ccd",
    fullName: "\u0caa\u0cc2\u0cb0\u0ccd\u0ca3 \u0cb9\u0cc6\u0cb8\u0cb0\u0cc1",
    username: "\u0cb5\u0cbf\u0cb3\u0cbe\u0cb8\u0ca8\u0cbe\u0cae",
    gender: "\u0cb2\u0cbf\u0c82\u0c97",
    role: "\u0caa\u0cbe\u0ca4\u0ccd\u0cb0",
    male: "\u0c97\u0c82\u0ca1\u0cc1",
    female: "\u0cb9\u0cc6\u0ca3\u0ccd\u0ca3\u0cc1",
    other: "\u0c87\u0ca4\u0cb0",
    customer: "\u0c97\u0ccd\u0cb0\u0cbe\u0cb9\u0c95",
    farmer: "\u0cb0\u0cc8\u0ca4",
    rememberMe: "\u0ca8\u0ca8\u0ccd\u0ca8\u0ca8\u0ccd\u0ca8\u0cc1 \u0ca8\u0cc6\u0ca8\u0caa\u0cbf\u0ca8\u0cb2\u0ccd\u0cb2\u0cbf \u0c87\u0ca1\u0cbf",
    forgot: "\u0cae\u0cb0\u0cc6\u0ca4\u0cbf\u0ca6\u0ccd\u0ca6\u0cc0\u0cb0\u0cbe?",
    verified: "\u0cb8\u0ca4\u0ccd\u0caf\u0cbe\u0caa\u0cbf\u0ca4",
    verify: "\u0cb8\u0ca4\u0ccd\u0caf\u0cbe\u0caa\u0cbf\u0cb8\u0cbf",
    personal: "\u0cb5\u0ccd\u0caf\u0c95\u0ccd\u0ca4\u0cbf\u0c97\u0ca4",
    security: "\u0cb8\u0cc1\u0cb0\u0c95\u0ccd\u0cb7\u0cc6",
    location: "\u0cb8\u0ccd\u0ca5\u0cb3",
    personalDetails: "\u0cb5\u0ccd\u0caf\u0c95\u0ccd\u0ca4\u0cbf\u0c97\u0ca4 \u0cb5\u0cbf\u0cb5\u0cb0\u0c97\u0cb3\u0cc1",
    enterBasicInfo: "\u0cae\u0cca\u0ca6\u0cb2\u0cc1 \u0ca8\u0cbf\u0cae\u0ccd\u0cae \u0cae\u0cc2\u0cb2\u0cad\u0cc2\u0ca4 \u0cae\u0cbe\u0cb9\u0cbf\u0ca4\u0cbf\u0caf\u0ca8\u0ccd\u0ca8\u0cc1 \u0ca8\u0cae\u0cc2\u0ca6\u0cbf\u0cb8\u0cbf.",
    emailAndPassword: "\u0c88\u0cae\u0cc7\u0cb2\u0ccd \u0cae\u0ca4\u0ccd\u0ca4\u0cc1 \u0caa\u0cbe\u0cb8\u0ccd\u0cb5\u0cb0\u0ccd\u0ca1\u0ccd",
    setEmailAndPassword: "\u0ca8\u0cbf\u0cae\u0ccd\u0cae \u0c88\u0cae\u0cc7\u0cb2\u0ccd \u0cae\u0ca4\u0ccd\u0ca4\u0cc1 \u0caa\u0cbe\u0cb8\u0ccd\u0cb5\u0cb0\u0ccd\u0ca1\u0ccd \u0cb8\u0cc6\u0c9f\u0ccd \u0cae\u0cbe\u0ca1\u0cbf.",
    geographicalDetails: "\u0cb8\u0ccd\u0ca5\u0cb3 \u0cb5\u0cbf\u0cb5\u0cb0\u0c97\u0cb3\u0cc1",
    addLocationInfo: "\u0cb8\u0cc8\u0ca8\u0ccd\u0c85\u0caa\u0ccd \u0cae\u0cc1\u0c97\u0cbf\u0cb8\u0cb2\u0cc1 \u0ca8\u0cbf\u0cae\u0ccd\u0cae \u0cb8\u0ccd\u0ca5\u0cb3 \u0cae\u0cbe\u0cb9\u0cbf\u0ca4\u0cbf\u0caf\u0ca8\u0ccd\u0ca8\u0cc1 \u0cb8\u0cc7\u0cb0\u0cbf\u0cb8\u0cbf.",
    city: "\u0ca8\u0c97\u0cb0",
    state: "\u0cb0\u0cbe\u0c9c\u0ccd\u0caf",
    district: "\u0c9c\u0cbf\u0cb2\u0ccd\u0cb2\u0cc6",
    pincode: "\u0caa\u0cbf\u0ca8\u0ccd\u0c95\u0ccb\u0ca1\u0ccd",
    back: "\u0cb9\u0cbf\u0c82\u0ca6\u0cc6",
    continue: "\u0cae\u0cc1\u0c82\u0ca6\u0cc1\u0cb5\u0cb0\u0cbf\u0cb8\u0cbf",
    createAccountButton: "\u0c96\u0cbe\u0ca4\u0cc6 \u0cb8\u0cc3\u0cb7\u0ccd\u0c9f\u0cbf\u0cb8\u0cbf",
    noAccount: "\u0c96\u0cbe\u0ca4\u0cc6 \u0c87\u0cb2\u0ccd\u0cb2\u0cb5\u0cc7?",
    alreadyHaveOne: "\u0c88\u0c97\u0cbe\u0c97\u0cb2\u0cc7 \u0c92\u0c82\u0ca6\u0cbf\u0ca6\u0cc6\u0caf\u0cc7?",
    signUpAction: "\u0cb8\u0cc8\u0ca8\u0ccd \u0c85\u0caa\u0ccd",
    loginAction: "\u0cb2\u0cbe\u0c97\u0cbf\u0ca8\u0ccd",
  },
  ML: {
    welcomeBack: "\u0d35\u0d40\u0d23\u0d4d\u0d1f\u0d41\u0d02 \u0d38\u0d4d\u0d35\u0d3e\u0d17\u0d24\u0d02",
    createAccount: "\u0d05\u0d15\u0d4d\u0d15\u0d57\u0d23\u0d4d\u0d1f\u0d4d \u0d38\u0d43\u0d37\u0d4d\u0d1f\u0d3f\u0d15\u0d4d\u0d15\u0d41\u0d15",
    verifyEmailThenLogin: "\u0d06\u0d26\u0d4d\u0d2f\u0d02 \u0d08\u0d2e\u0d46\u0d2f\u0d3f\u0d32\u0d4d \u0d38\u0d24\u0d4d\u0d2f\u0d3e\u0d2a\u0d3f\u0d15\u0d4d\u0d15\u0d42, \u0d24\u0d41\u0d1f\u0d30\u0d4d\u0d28\u0d4d\u0d28\u0d4d \u0d32\u0d4b\u0d17\u0d3f\u0d28\u0d4d \u0d1a\u0d46\u0d2f\u0d4d\u0d2f\u0d42",
    stepByStepSignup: "\u0d18\u0d1f\u0d4d\u0d1f\u0d02 \u0d18\u0d1f\u0d4d\u0d1f\u0d2e\u0d3e\u0d2f \u0d38\u0d48\u0d28\u0d4d\u200c\u0d05\u0d2a\u0d4d",
    login: "\u0d32\u0d4b\u0d17\u0d3f\u0d28\u0d4d",
    signup: "\u0d38\u0d48\u0d28\u0d4d\u200c\u0d05\u0d2a\u0d4d",
    email: "\u0d08\u0d2e\u0d46\u0d2f\u0d3f\u0d32\u0d4d",
    password: "\u0d2a\u0d3e\u0d38\u0d4d\u0d35\u0d47\u0d21\u0d4d",
    fullName: "\u0d2a\u0d42\u0d30\u0d4d\u0d23 \u0d2a\u0d47\u0d30\u0d4d",
    username: "\u0d2f\u0d42\u0d38\u0d30\u0d4d\u200c\u0d28\u0d47\u0d2e\u0d4d",
    gender: "\u0d32\u0d3f\u0d02\u0d17\u0d02",
    role: "\u0d2d\u0d42\u0d2e\u0d3f\u0d15",
    male: "\u0d06\u0d23\u0d4d",
    female: "\u0d38\u0d4d\u0d24\u0d4d\u0d30\u0d40",
    other: "\u0d2e\u0d31\u0d4d\u0d31\u0d4d",
    customer: "\u0d09\u0d2a\u0d2d\u0d4b\u0d15\u0d4d\u0d24\u0d3e\u0d35\u0d4d",
    farmer: "\u0d15\u0d30\u0d4d\u200d\u0d37\u0d15\u0d7b",
    rememberMe: "\u0d0e\u0d28\u0d4d\u0d28\u0d46 \u0d13\u0d30\u0d4d\u200d\u0d2e\u0d3f\u0d15\u0d4d\u0d15\u0d42",
    forgot: "\u0d2e\u0d31\u0d28\u0d4d\u0d28\u0d41\u0d2a\u0d4b\u0d2f\u0d4b?",
    verified: "\u0d38\u0d24\u0d4d\u0d2f\u0d3e\u0d2a\u0d3f\u0d1a\u0d4d\u0d1a\u0d41",
    verify: "\u0d38\u0d24\u0d4d\u0d2f\u0d3e\u0d2a\u0d3f\u0d15\u0d4d\u0d15\u0d42",
    personal: "\u0d35\u0d4d\u0d2f\u0d15\u0d4d\u0d24\u0d3f\u0d17\u0d24",
    security: "\u0d38\u0d41\u0d30\u0d15\u0d4d\u0d37",
    location: "\u0d38\u0d4d\u0d25\u0d32\u0d02",
    personalDetails: "\u0d35\u0d4d\u0d2f\u0d15\u0d4d\u0d24\u0d3f\u0d17\u0d24 \u0d35\u0d3f\u0d35\u0d30\u0d19\u0d4d\u0d19\u0d7e",
    enterBasicInfo: "\u0d06\u0d26\u0d4d\u0d2f\u0d02 \u0d24\u0d99\u0d4d\u0d19\u0d33\u0d41\u0d1f\u0d46 \u0d05\u0d1f\u0d3f\u0d38\u0d4d\u0d25\u0d3e\u0d28 \u0d35\u0d3f\u0d35\u0d30\u0d19\u0d4d\u0d19\u0d7e \u0d28\u0d7d\u0d15\u0d42.",
    emailAndPassword: "\u0d08\u0d2e\u0d46\u0d2f\u0d3f\u0d32\u0d41\u0d02 \u0d2a\u0d3e\u0d38\u0d4d\u0d35\u0d47\u0d21\u0d4d\u0d09\u0d02",
    setEmailAndPassword: "\u0d28\u0d3f\u0d99\u0d4d\u0d19\u0d33\u0d41\u0d1f\u0d46 \u0d08\u0d2e\u0d46\u0d2f\u0d3f\u0d32\u0d41\u0d02 \u0d2a\u0d3e\u0d38\u0d4d\u0d35\u0d47\u0d21\u0d4d\u0d09\u0d02 \u0d38\u0d46\u0d31\u0d4d\u0d31\u0d4d \u0d1a\u0d46\u0d2f\u0d4d\u0d2f\u0d42.",
    geographicalDetails: "\u0d38\u0d4d\u0d25\u0d32 \u0d35\u0d3f\u0d35\u0d30\u0d19\u0d4d\u0d19\u0d7e",
    addLocationInfo: "\u0d38\u0d48\u0d28\u0d4d\u200c\u0d05\u0d2a\u0d4d \u0d2a\u0d42\u0d30\u0d4d\u0d24\u0d4d\u0d24\u0d3f\u0d2f\u0d3e\u0d15\u0d4d\u0d15\u0d3e\u0d28\u0d4d \u0d28\u0d3f\u0d99\u0d4d\u0d19\u0d33\u0d41\u0d1f\u0d46 \u0d38\u0d4d\u0d25\u0d32 \u0d35\u0d3f\u0d35\u0d30\u0d19\u0d4d\u0d19\u0d7e \u0d1a\u0d47\u0d30\u0d4d\u0d15\u0d4d\u0d15\u0d42.",
    city: "\u0d28\u0d17\u0d30\u0d02",
    state: "\u0d38\u0d02\u0d38\u0d4d\u0d25\u0d3e\u0d28\u0d02",
    district: "\u0d1c\u0d3f\u0d32\u0d4d\u0d32",
    pincode: "\u0d2a\u0d3f\u0d7b\u0d15\u0d4b\u0d21\u0d4d",
    back: "\u0d24\u0d3f\u0d30\u0d3f\u0d1a\u0d4d\u0d1a\u0d4d",
    continue: "\u0d24\u0d41\u0d1f\u0d30\u0d42",
    createAccountButton: "\u0d05\u0d15\u0d4d\u0d15\u0d57\u0d23\u0d4d\u0d1f\u0d4d \u0d38\u0d43\u0d37\u0d4d\u0d1f\u0d3f\u0d15\u0d4d\u0d15\u0d41\u0d15",
    noAccount: "\u0d05\u0d15\u0d4d\u0d15\u0d57\u0d23\u0d4d\u0d1f\u0d4d \u0d07\u0d32\u0d4d\u0d32\u0d47?",
    alreadyHaveOne: "\u0d07\u0d24\u0d3f\u0d28\u0d15\u0d02 \u0d12\u0d28\u0d4d\u0d28\u0d41\u0d23\u0d4d\u0d1f\u0d4b?",
    signUpAction: "\u0d38\u0d48\u0d28\u0d4d\u200c\u0d05\u0d2a\u0d4d",
    loginAction: "\u0d32\u0d4b\u0d17\u0d3f\u0d28\u0d4d",
  },
};

export default function RedesignedAuthLayout({ authScreen, busy, login, register, setAuthScreen, setLogin, setRegister, onStartEmailVerification, onCompleteEmailVerification, onLogin, onRegister }: Props) {
  const [signupStep, setSignupStep] = useState(1);
  const [signupConfirmPassword, setSignupConfirmPassword] = useState("");
  const [showLoginPassword, setShowLoginPassword] = useState(false);
  const [showSignupPassword, setShowSignupPassword] = useState(false);
  const [showSignupConfirmPassword, setShowSignupConfirmPassword] = useState(false);
  const [otpModalOpen, setOtpModalOpen] = useState(false);
  const [otpCode, setOtpCode] = useState(["", "", "", "", "", ""]);
  const [otpError, setOtpError] = useState("");
  const [feedback, setFeedback] = useState<Feedback>(null);
  const [emailVerified, setEmailVerified] = useState(false);
  const [registerEmailVerified, setRegisterEmailVerified] = useState(false);
  const [verificationChallengeId, setVerificationChallengeId] = useState("");
  const [verificationPurpose, setVerificationPurpose] = useState<VerificationPurpose>("email_verification");
  const [verificationEmail, setVerificationEmail] = useState("");
  const [verificationTarget, setVerificationTarget] = useState<VerificationTarget>("login");
  const [demoOtp, setDemoOtp] = useState("");
  const [otpResendCountdown, setOtpResendCountdown] = useState(0);
  const [selectedLanguage, setSelectedLanguage] = useState<LanguageCode>("EN");
  const [languageMenuOpen, setLanguageMenuOpen] = useState(false);
  const otpRefs = useRef<any[]>([]);
  const t = (key: TranslationKey) => AUTH_COPY[selectedLanguage][key] || AUTH_COPY.EN[key];
  const focusOtpInput = (index = 0) => setTimeout(() => otpRefs.current[index]?.focus?.(), 80);

  const gender = register.gender || "Male";
  const roleLabel = useMemo(() => ((register.role || "customer").toLowerCase() === "farmer" ? "Farmer" : "Customer"), [register.role]);

  useEffect(() => {
    if (otpResendCountdown <= 0) return;
    const timer = setTimeout(() => setOtpResendCountdown((current) => current - 1), 1000);
    return () => clearTimeout(timer);
  }, [otpResendCountdown]);

  const switchTab = (next: AuthTab, nextFeedback: Feedback = null) => {
    setLanguageMenuOpen(false);
    setFeedback(nextFeedback);
    setOtpModalOpen(false);
    setOtpError("");
    setOtpCode(["", "", "", "", "", ""]);
    if (next === "register") {
      setSignupStep(1);
      setSignupConfirmPassword("");
      setAuthScreen("register");
      return;
    }
    setAuthScreen("login");
  };

  const updateLoginEmail = (value: string) => {
    setLogin((current) => ({ ...current, email: value }));
    setFeedback(null);
    const normalized = value.trim().toLowerCase();
    if (normalized !== verificationEmail) {
      setEmailVerified(false);
      setVerificationChallengeId("");
      setVerificationPurpose("email_verification");
      setVerificationEmail("");
      setDemoOtp("");
    }
  };

  const updateLoginPassword = (value: string) => {
    setLogin((current) => ({ ...current, password: value }));
    setFeedback(null);
  };

  const updateRegisterField = <K extends keyof RegisterState>(key: K, value: RegisterState[K]) => {
    setRegister((current) => ({ ...current, [key]: value }));
    setFeedback(null);
    if (key === "email") {
      const normalized = String(value || "").trim().toLowerCase();
      if (normalized !== verificationEmail || verificationTarget !== "register") {
        setRegisterEmailVerified(false);
        setVerificationPurpose("signup_email_verification");
      }
    }
  };

  const openOtpModal = async (target: VerificationTarget) => {
    const normalizedEmail = (target === "login" ? login.email : register.email).trim().toLowerCase();
    if (!normalizedEmail) {
      setFeedback({ tone: "error", text: "Enter your email first." });
      return;
    }

    const result = await onStartEmailVerification(normalizedEmail, target);
    if (!result.ok) {
      setFeedback({ tone: "error", text: result.message });
      return;
    }

    setVerificationChallengeId(result.challengeId || "");
    setVerificationPurpose(result.purpose === "signup_email_verification" ? "signup_email_verification" : "email_verification");
    setVerificationEmail((result.email || normalizedEmail).trim().toLowerCase());
    setVerificationTarget(target);
    setDemoOtp(result.otp || "");
    setOtpResendCountdown(OTP_RESEND_SECONDS);
    setOtpCode(["", "", "", "", "", ""]);
    setOtpError("");
    setFeedback(null);
    setOtpModalOpen(true);
  };

  const resendOtp = async () => {
    const sourceEmail = verificationTarget === "register" ? register.email : login.email;
    const normalizedEmail = (verificationEmail || sourceEmail).trim().toLowerCase();
    if (!normalizedEmail) {
      setOtpError("Enter your email first.");
      return;
    }
    const result = await onStartEmailVerification(normalizedEmail, verificationTarget);
    if (!result.ok) {
      setOtpError(result.message);
      return;
    }
    setVerificationChallengeId(result.challengeId || verificationChallengeId);
    setVerificationPurpose(result.purpose === "signup_email_verification" ? "signup_email_verification" : verificationPurpose);
    setVerificationEmail((result.email || normalizedEmail).trim().toLowerCase());
    setDemoOtp(result.otp || "");
    setOtpResendCountdown(OTP_RESEND_SECONDS);
    setOtpCode(["", "", "", "", "", ""]);
    setOtpError("");
    focusOtpInput(0);
  };

  const verifyOtp = async () => {
    const code = otpCode.join("");
    if (code.length !== 6) {
      setOtpError("Enter the 6-digit OTP.");
      return;
    }
    if (!verificationChallengeId || !verificationEmail) {
      setOtpError("Start email verification again.");
      return;
    }

    const result = await onCompleteEmailVerification({ challengeId: verificationChallengeId, email: verificationEmail, otp: code, purpose: verificationPurpose });
    if (!result.ok) {
      setOtpError(result.message);
      return;
    }

    if (verificationTarget === "register") {
      setRegisterEmailVerified(true);
    } else {
      setEmailVerified(true);
    }
    setOtpModalOpen(false);
    setOtpError("");
    setFeedback({ tone: "success", text: result.message || "Email verified. Now enter your password." });
  };

  const handleLogin = async () => {
    const normalizedEmail = login.email.trim().toLowerCase();
    if (!normalizedEmail) {
      setFeedback({ tone: "error", text: "Enter your email first." });
      return;
    }
    if (!emailVerified || !verificationChallengeId) {
      setFeedback({ tone: "error", text: "Verify your email before login." });
      return;
    }
    if (!login.password.trim()) {
      setFeedback({ tone: "error", text: "Enter your password." });
      return;
    }

    const result = await onLogin({ challengeId: verificationChallengeId, email: normalizedEmail, password: login.password });
    if (!result.ok) {
      setFeedback({ tone: "error", text: result.message });
      return;
    }

    setFeedback({ tone: "success", text: result.message || "Login successful." });
  };

  const validateSignupStep = () => {
    if (signupStep === 1) {
      if (!register.full_name.trim()) {
        setFeedback({ tone: "error", text: "Enter your full name." });
        return false;
      }
      if (!register.username.trim()) {
        setFeedback({ tone: "error", text: "Enter your username." });
        return false;
      }
      return true;
    }

    if (signupStep === 2) {
      if (!register.email.trim()) {
        setFeedback({ tone: "error", text: "Enter your email." });
        return false;
      }
      if (!registerEmailVerified) {
        setFeedback({ tone: "error", text: "Verify your email before continuing." });
        return false;
      }
      if (!register.password) {
        setFeedback({ tone: "error", text: "Enter your password." });
        return false;
      }
      if (register.password.length < 8) {
        setFeedback({ tone: "error", text: "Password must be at least 8 characters." });
        return false;
      }
      if (!signupConfirmPassword) {
        setFeedback({ tone: "error", text: "Confirm your password." });
        return false;
      }
      if (register.password !== signupConfirmPassword) {
        setFeedback({ tone: "error", text: "Passwords do not match." });
        return false;
      }
      return true;
    }

    if (!register.city.trim() || !register.state.trim() || !register.district.trim() || !register.pincode.trim()) {
      setFeedback({ tone: "error", text: "Complete all location fields." });
      return false;
    }
    return true;
  };

  const continueSignup = async () => {
    if (!validateSignupStep()) return;
    if (signupStep < 3) {
      setFeedback(null);
      setSignupStep((current) => current + 1);
      return;
    }

    const result = await onRegister({ ...register, role: roleLabel.toLowerCase(), gender });
    if (!result.ok) {
      setFeedback({ tone: "error", text: result.message });
      return;
    }

    setEmailVerified(false);
    setRegisterEmailVerified(false);
    setVerificationChallengeId("");
    setVerificationPurpose("email_verification");
    setVerificationEmail("");
    setVerificationTarget("login");
    setDemoOtp("");
    switchTab("login", { tone: "success", text: result.message || "Account created successfully. Login now." });
  };

  const selectedLanguageOption = useMemo(() => LANGUAGE_OPTIONS.find((option) => option.code === selectedLanguage) || LANGUAGE_OPTIONS[0], [selectedLanguage]);

  const chooseLanguage = (language: LanguageCode) => {
    setSelectedLanguage(language);
    setLanguageMenuOpen(false);
  };

  const feedbackStyles = feedback?.tone === "success" ? styles.successFeedback : feedback?.tone === "info" ? styles.infoFeedback : styles.errorFeedback;

  return (
    <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={styles.flex}>
      <View style={styles.screen}>
        <View pointerEvents="none" style={styles.backgroundBlobTop} />
        <View pointerEvents="none" style={styles.backgroundBlobMiddle} />
        <View pointerEvents="none" style={styles.backgroundBlobBottom} />

        <View style={styles.stickyHeaderShell}>
          <View style={[styles.brandCard, languageMenuOpen ? styles.brandCardRaised : null]}>
            <View style={styles.brandRow}>
              <View style={styles.brandLeft}>
                <View style={styles.brandIcon}><FontAwesome6 color="#FFFFFF" name="seedling" size={22} /></View>
                <View><Text style={styles.brandTitle}>Smart Farmer</Text></View>
              </View>
              <View style={styles.languageMenuWrap}>
                <Pressable onPress={() => setLanguageMenuOpen((current) => !current)} style={styles.languagePill}>
                  <Feather color={BRAND_GREEN} name="globe" size={16} />
                  <Text style={styles.languageText}>{selectedLanguageOption.code}</Text>
                  <Feather color="#5B6D60" name={languageMenuOpen ? "chevron-up" : "chevron-down"} size={16} />
                </Pressable>
                {languageMenuOpen ? (
                  <View style={styles.languageDropdown}>
                    {LANGUAGE_OPTIONS.map((option) => {
                      const active = option.code === selectedLanguage;
                      return (
                        <Pressable key={option.code} onPress={() => chooseLanguage(option.code)} style={[styles.languageDropdownOption, active ? styles.languageDropdownOptionActive : null]}>
                          <Text style={[styles.languageDropdownCode, active ? styles.languageDropdownCodeActive : null]}>{option.code}</Text>
                          <Text style={[styles.languageDropdownLabel, active ? styles.languageDropdownLabelActive : null]}>{option.label}</Text>
                        </Pressable>
                      );
                    })}
                  </View>
                ) : null}
              </View>
            </View>
          </View>
        </View>

        <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled" onScrollBeginDrag={() => setLanguageMenuOpen(false)} showsVerticalScrollIndicator={false} overScrollMode="never">
          <View style={styles.scrollInner}>
            <View style={styles.titleBlock}>
              <Text style={styles.heroHeading}>{authScreen === "login" ? t("welcomeBack") : t("createAccount")}</Text>
              <Text style={styles.heroSubheading}>{authScreen === "login" ? t("verifyEmailThenLogin") : t("stepByStepSignup")}</Text>
            </View>

            <View style={styles.mainCard}>
              <SegmentedControl loginLabel={t("login")} onChange={switchTab} signupLabel={t("signup")} value={authScreen} />

              {authScreen === "login" ? (
                <View style={styles.sectionStack}>
                  <InputRow
                    icon={<Feather color={BRAND_GREEN} name="mail" size={18} />}
                    label={t("email")}
                    placeholder="name@example.com"
                    value={login.email}
                    onChangeText={updateLoginEmail}
                    keyboardType="email-address"
                    trailing={<Pressable disabled={busy.length > 0 || emailVerified} onPress={() => openOtpModal("login")} style={[styles.verifyButton, emailVerified ? styles.verifyButtonDone : null, (busy.length > 0 || emailVerified) ? styles.disabledButton : null]}><Text style={[styles.verifyButtonText, emailVerified ? styles.verifyButtonDoneText : null]}>{emailVerified ? t("verified") : t("verify")}</Text></Pressable>}
                  />

                  <InputRow
                    icon={<Feather color={BRAND_GREEN} name="lock" size={18} />}
                    label={t("password")}
                    placeholder={emailVerified ? "Enter password" : "Verify email first"}
                    value={login.password}
                    onChangeText={updateLoginPassword}
                    secureTextEntry={!showLoginPassword}
                    disabled={!emailVerified}
                    trailing={<IconToggle visible={showLoginPassword} onPress={() => setShowLoginPassword((current) => !current)} />}
                  />

                  <View style={styles.rowBetween}>
                    <View style={styles.rememberRow}>
                      <View style={styles.rememberBoxOuter}><View style={styles.rememberBoxInner} /></View>
                      <Text style={styles.rememberText}>{t("rememberMe")}</Text>
                    </View>
                    <Pressable onPress={() => setAuthScreen("forgot")}><Text style={styles.forgotText}>{t("forgot")}</Text></Pressable>
                  </View>

                  {feedback ? <View style={[styles.feedbackBox, feedbackStyles]}><Text style={styles.feedbackText}>{feedback.text}</Text></View> : null}
                  <PrimaryButton disabled={busy.length > 0} label={busy || t("loginAction")} onPress={handleLogin} />
                </View>
              ) : (
                <View style={styles.sectionStack}>
                  <View style={styles.stepperWrap}>
                    <StepChip active={signupStep === 1} done={signupStep > 1} label={t("personal")} number={1} />
                    <StepChip active={signupStep === 2} done={signupStep > 2} label={t("security")} number={2} />
                    <StepChip active={signupStep === 3} done={false} label={t("location")} number={3} isLast />
                  </View>

                  <View>
                    <Text style={styles.stepTitle}>{signupStep === 1 ? t("personalDetails") : signupStep === 2 ? t("emailAndPassword") : t("geographicalDetails")}</Text>
                    <Text style={styles.stepSubtitle}>{signupStep === 1 ? t("enterBasicInfo") : signupStep === 2 ? t("setEmailAndPassword") : t("addLocationInfo")}</Text>
                  </View>

                  {signupStep === 1 ? (
                    <View style={styles.sectionStack}>
                      <InputRow icon={<Feather color={BRAND_GREEN} name="user" size={18} />} label={t("fullName")} placeholder={t("fullName")} value={register.full_name} onChangeText={(value) => updateRegisterField("full_name", value)} />
                      <InputRow icon={<Feather color={BRAND_GREEN} name="user" size={18} />} label={t("username")} placeholder={t("username")} value={register.username} onChangeText={(value) => updateRegisterField("username", value)} autoCapitalize="none" />
                      <SelectionPills columns={3} items={[t("male"), t("female"), t("other")]} label={t("gender")} onChange={(value) => updateRegisterField("gender", value === t("male") ? "Male" : value === t("female") ? "Female" : "Other")} value={gender === "Male" ? t("male") : gender === "Female" ? t("female") : t("other")} />
                      <SelectionPills items={[t("customer"), t("farmer")]} label={t("role")} onChange={(value) => updateRegisterField("role", value === t("farmer") ? "farmer" : "customer")} value={roleLabel === "Farmer" ? t("farmer") : t("customer")} />
                    </View>
                  ) : null}

                  {signupStep === 2 ? (
                    <View style={styles.sectionStack}>
                      <InputRow icon={<Feather color={BRAND_GREEN} name="mail" size={18} />} label={t("email")} placeholder="name@example.com" value={register.email} onChangeText={(value) => updateRegisterField("email", value)} keyboardType="email-address" trailing={<Pressable disabled={busy.length > 0 || registerEmailVerified} onPress={() => openOtpModal("register")} style={[styles.verifyButton, registerEmailVerified ? styles.verifyButtonDone : null, (busy.length > 0 || registerEmailVerified) ? styles.disabledButton : null]}><Text style={[styles.verifyButtonText, registerEmailVerified ? styles.verifyButtonDoneText : null]}>{registerEmailVerified ? t("verified") : t("verify")}</Text></Pressable>} />
                      <InputRow icon={<Feather color={BRAND_GREEN} name="lock" size={18} />} label={t("password")} placeholder={t("password")} value={register.password} onChangeText={(value) => updateRegisterField("password", value)} secureTextEntry={!showSignupPassword} trailing={<IconToggle visible={showSignupPassword} onPress={() => setShowSignupPassword((current) => !current)} />} />
                      <InputRow icon={<Feather color={BRAND_GREEN} name="lock" size={18} />} label={`${t("password")} (${t("verify").toLowerCase()})`} placeholder={t("password")} value={signupConfirmPassword} onChangeText={setSignupConfirmPassword} secureTextEntry={!showSignupConfirmPassword} trailing={<IconToggle visible={showSignupConfirmPassword} onPress={() => setShowSignupConfirmPassword((current) => !current)} />} />
                    </View>
                  ) : null}

                  {signupStep === 3 ? (
                    <View style={styles.locationStack}>
                      <InputRow icon={<Feather color={BRAND_GREEN} name="map-pin" size={18} />} label={t("city")} placeholder={t("city")} value={register.city} onChangeText={(value) => updateRegisterField("city", value)} />
                      <InputRow icon={<Feather color={BRAND_GREEN} name="map" size={18} />} label={t("state")} placeholder={t("state")} value={register.state} onChangeText={(value) => updateRegisterField("state", value)} />
                      <InputRow icon={<MaterialCommunityIcons color={BRAND_GREEN} name="office-building-outline" size={20} />} label={t("district")} placeholder={t("district")} value={register.district} onChangeText={(value) => updateRegisterField("district", value)} />
                      <InputRow icon={<Feather color={BRAND_GREEN} name="hash" size={18} />} label={t("pincode")} placeholder={t("pincode")} value={register.pincode} onChangeText={(value) => updateRegisterField("pincode", value)} keyboardType="number-pad" />
                    </View>
                  ) : null}

                  {feedback ? <View style={[styles.feedbackBox, feedbackStyles]}><Text style={styles.feedbackText}>{feedback.text}</Text></View> : null}

                  <View style={styles.signupActions}>
                    {signupStep > 1 ? <SecondaryButton label={t("back")} onPress={() => { setFeedback(null); setSignupStep((current) => current - 1); }} /> : null}
                    <PrimaryButton compact={signupStep > 1} disabled={busy.length > 0} label={busy || (signupStep === 3 ? t("createAccountButton") : t("continue"))} onPress={continueSignup} />
                  </View>
                </View>
              )}

              <View style={styles.footerPromptRow}>
                <Text style={styles.footerPromptText}>{authScreen === "login" ? t("noAccount") : t("alreadyHaveOne")} </Text>
                <Pressable onPress={() => switchTab(authScreen === "login" ? "register" : "login")}><Text style={styles.footerPromptAction}>{authScreen === "login" ? t("signUpAction") : t("loginAction")}</Text></Pressable>
              </View>
            </View>
          </View>
        </ScrollView>

        <Modal animationType="fade" onRequestClose={() => setOtpModalOpen(false)} onShow={() => focusOtpInput(0)} statusBarTranslucent transparent visible={otpModalOpen}>
          <View style={styles.modalOverlay}>
            <View style={styles.modalCard}>
              <View style={styles.modalHeaderRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.modalTitle}>Verify email</Text>
                  <Text style={styles.modalSubtitle}>Enter the OTP sent to {verificationEmail || login.email || "your email"}.</Text>
                </View>
                <Pressable onPress={() => setOtpModalOpen(false)} style={styles.modalCloseButton}><Feather color="#5B665F" name="x" size={18} /></Pressable>
              </View>

              <View style={styles.otpRow}>
                {otpCode.map((digit, index) => (
                  <Pressable key={`otp-${index}`} onPress={() => focusOtpInput(index)} style={styles.otpCell}>
                    {index === 3 ? <Text style={styles.otpDivider}>-</Text> : null}
                    <TextInput
                      ref={(element) => { otpRefs.current[index] = element; }}
                      autoFocus={index === 0}
                      autoComplete="sms-otp"
                      contextMenuHidden
                      importantForAutofill="yes"
                      keyboardType="number-pad"
                      maxLength={1}
                      onChangeText={(value) => {
                        const clean = value.replace(/\D/g, "").slice(-1);
                        setOtpCode((current) => {
                          const next = [...current];
                          next[index] = clean;
                          return next;
                        });
                        setOtpError("");
                        if (clean && index < 5) otpRefs.current[index + 1]?.focus();
                      }}
                      onKeyPress={(event) => {
                        if (event.nativeEvent.key === "Backspace" && !digit && index > 0) otpRefs.current[index - 1]?.focus();
                      }}
                      selectionColor={BRAND_GREEN}
                      showSoftInputOnFocus
                      style={styles.otpInput}
                      textContentType="oneTimeCode"
                      value={digit}
                    />
                  </Pressable>
                ))}
              </View>

              <View style={styles.modalMetaRow}>
                <Pressable disabled={otpResendCountdown > 0} onPress={resendOtp}><Text style={[styles.modalLink, otpResendCountdown > 0 ? styles.modalLinkDisabled : null]}>{otpResendCountdown > 0 ? `Send Again in 00:${String(otpResendCountdown).padStart(2, "0")}` : "Send Again"}</Text></Pressable>
                <Text style={styles.modalOtpHint}>{demoOtp ? `Demo OTP: ${demoOtp}` : "Check your email inbox"}</Text>
              </View>
              {otpError ? <Text style={styles.modalError}>{otpError}</Text> : null}
              <View style={styles.modalActions}>
                <Pressable onPress={() => setOtpModalOpen(false)} style={styles.modalSecondaryAction}><Text style={styles.modalSecondaryActionText}>Cancel</Text></Pressable>
                <Pressable disabled={busy.length > 0} onPress={verifyOtp} style={[styles.modalPrimaryAction, busy.length > 0 ? styles.disabledButton : null]}><Text style={styles.modalPrimaryActionText}>{busy || "Verify OTP"}</Text></Pressable>
              </View>
            </View>
          </View>
        </Modal>
      </View>
    </KeyboardAvoidingView>
  );
}

type InputRowProps = {
  icon: React.ReactNode;
  label: string;
  placeholder: string;
  value: string;
  onChangeText: (value: string) => void;
  trailing?: React.ReactNode;
  secureTextEntry?: boolean;
  disabled?: boolean;
  keyboardType?: "default" | "email-address" | "number-pad";
  autoCapitalize?: "none" | "sentences";
};

function InputRow({ icon, label, placeholder, value, onChangeText, trailing, secureTextEntry, disabled = false, keyboardType = "default", autoCapitalize = keyboardType === "email-address" ? "none" : "sentences" }: InputRowProps) {
  return (
    <View style={styles.inputBlock}>
      <Text style={styles.inputLabel}>{label}</Text>
      <View style={[styles.inputShell, disabled ? styles.inputShellDisabled : null]}>
        <View style={styles.inputIconWrap}>{icon}</View>
        <TextInput autoCapitalize={autoCapitalize} editable={!disabled} keyboardType={keyboardType} onChangeText={onChangeText} placeholder={placeholder} placeholderTextColor="#9AA69D" secureTextEntry={secureTextEntry} selectionColor={BRAND_GREEN} style={styles.inputText} value={value} />
        {trailing}
      </View>
    </View>
  );
}

function IconToggle({ visible, onPress }: { visible: boolean; onPress: () => void }) {
  return <Pressable onPress={onPress} style={styles.iconToggle}><Feather color="#5C6A61" name={visible ? "eye-off" : "eye"} size={18} /></Pressable>;
}

function SegmentedControl({ value, onChange, loginLabel, signupLabel }: { value: AuthTab; onChange: (next: AuthTab) => void; loginLabel: string; signupLabel: string }) {
  return (
    <View style={styles.segmentedWrap}>
      {[{ label: loginLabel, value: "login" as const }, { label: signupLabel, value: "register" as const }].map((item) => {
        const active = value === item.value;
        return <Pressable key={item.value} onPress={() => onChange(item.value)} style={[styles.segmentedButton, active ? styles.segmentedButtonActive : null]}><Text style={[styles.segmentedButtonText, active ? styles.segmentedButtonTextActive : null]}>{item.label}</Text></Pressable>;
      })}
    </View>
  );
}

function StepChip({ number, label, active, done, isLast = false }: { number: number; label: string; active: boolean; done: boolean; isLast?: boolean }) {
  return <View style={styles.stepItem}>{!isLast ? <View style={styles.stepLine} /> : null}<View style={[styles.stepCircle, active || done ? styles.stepCircleActive : null]}>{done ? <Feather color="#FFFFFF" name="check" size={14} /> : <Text style={[styles.stepNumber, active ? styles.stepNumberActive : null]}>{number}</Text>}</View><Text style={[styles.stepLabel, active ? styles.stepLabelActive : done ? styles.stepLabelDone : null]}>{label}</Text></View>;
}

function SelectionPills({ label, value, onChange, items, columns = 2, stretchLastItem = false }: { label: string; value: string; onChange: (item: string) => void; items: string[]; columns?: 2 | 3; stretchLastItem?: boolean }) {
  return (
    <View style={styles.selectionBlock}>
      <Text style={styles.inputLabel}>{label}</Text>
      <View style={[styles.selectionWrap, columns === 3 ? styles.selectionWrapNoWrap : null]}>
        {items.map((item, index) => {
          const active = value === item;
          const isOddLastItem = stretchLastItem && columns === 2 && items.length % 2 === 1 && index === items.length - 1;
          return <Pressable key={item} onPress={() => onChange(item)} style={[styles.selectionButton, columns === 3 ? styles.selectionButtonThird : styles.selectionButtonHalf, isOddLastItem ? styles.selectionButtonFull : null, active ? styles.selectionButtonActive : null]}><Text style={[styles.selectionButtonText, active ? styles.selectionButtonTextActive : null]}>{item}</Text></Pressable>;
        })}
      </View>
    </View>
  );
}

function PrimaryButton({ label, onPress, disabled, compact = false }: { label: string; onPress: () => void; disabled?: boolean; compact?: boolean }) {
  return <Pressable disabled={disabled} onPress={onPress} style={[styles.primaryButton, compact ? styles.primaryButtonCompact : styles.primaryButtonFullWidth, disabled ? styles.disabledButton : null]}><Text style={styles.primaryButtonText}>{label}</Text><Feather color="#FFFFFF" name="arrow-right" size={18} /></Pressable>;
}

function SecondaryButton({ label, onPress }: { label: string; onPress: () => void }) {
  return <Pressable onPress={onPress} style={styles.secondaryButton}><Feather color={TEXT_DARK} name="arrow-left" size={18} /><Text style={styles.secondaryButtonText}>{label}</Text></Pressable>;
}

const shadow = Platform.select({ ios: { shadowColor: "#14281D", shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.12, shadowRadius: 24 }, android: { elevation: 8 }, default: {} });

const styles = StyleSheet.create({
  flex: { flex: 1 },
  screen: { flex: 1, backgroundColor: "#EEF4EF" },
  backgroundBlobTop: { position: "absolute", top: -120, left: -40, width: 260, height: 260, borderRadius: 130, backgroundColor: "rgba(234,246,238,0.95)" },
  backgroundBlobMiddle: { position: "absolute", top: 180, right: -100, width: 260, height: 260, borderRadius: 130, backgroundColor: "rgba(247,245,239,0.95)" },
  backgroundBlobBottom: { position: "absolute", bottom: -110, left: -30, width: 280, height: 280, borderRadius: 140, backgroundColor: "rgba(232,239,232,0.96)" },
  scrollContent: { paddingHorizontal: 18, paddingBottom: 36 },
  scrollInner: { gap: 14 },
  stickyHeaderShell: { paddingHorizontal: 18, paddingTop: 14, paddingBottom: 10, backgroundColor: "#EEF4EF", zIndex: 8 },
  brandCard: { borderWidth: 1, borderColor: "#E6EFE8", borderRadius: 26, backgroundColor: "#F4F8F3", paddingHorizontal: 16, paddingVertical: 14, ...shadow },
  brandCardRaised: { overflow: "visible", zIndex: 12 },
  brandRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 },
  brandLeft: { flexDirection: "row", alignItems: "center", gap: 12, flexShrink: 1 },
  brandIcon: { width: 48, height: 48, borderRadius: 18, backgroundColor: BRAND_GREEN, alignItems: "center", justifyContent: "center", ...Platform.select({ ios: { shadowColor: BRAND_GREEN, shadowOpacity: 0.22, shadowRadius: 16, shadowOffset: { width: 0, height: 8 } }, android: { elevation: 5 }, default: {} }) },
  brandTitle: { fontSize: 24, fontWeight: "800", color: TEXT_DARK },
  languageMenuWrap: { position: "relative", zIndex: 20 },
  languagePill: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 12, paddingVertical: 10, borderRadius: 999, borderWidth: 1, borderColor: "rgba(255,255,255,0.9)", backgroundColor: "rgba(255,255,255,0.92)" },
  languageText: { color: TEXT_DARK, fontSize: 13, fontWeight: "700" },
  languageDropdown: { position: "absolute", top: "100%", right: 0, marginTop: 10, minWidth: 152, borderRadius: 18, borderWidth: 1, borderColor: "#E2EBE4", backgroundColor: "#FFFFFF", padding: 6, ...shadow },
  languageDropdownOption: { flexDirection: "row", alignItems: "center", gap: 10, borderRadius: 14, paddingHorizontal: 12, paddingVertical: 11 },
  languageDropdownOptionActive: { backgroundColor: "#EEF7F0" },
  languageDropdownCode: { width: 28, color: "#617066", fontSize: 12, fontWeight: "800" },
  languageDropdownCodeActive: { color: BRAND_GREEN },
  languageDropdownLabel: { color: TEXT_DARK, fontSize: 14, fontWeight: "600" },
  languageDropdownLabelActive: { color: BRAND_GREEN },
  titleBlock: { marginTop: 22, marginBottom: 16 },
  heroHeading: { fontSize: 36, lineHeight: 38, fontWeight: "800", color: TEXT_DARK },
  heroSubheading: { marginTop: 8, fontSize: 15, lineHeight: 22, color: TEXT_MUTED },
  mainCard: { borderRadius: 34, borderWidth: 1, borderColor: "rgba(255,255,255,0.82)", backgroundColor: CARD_BG, padding: 18, ...shadow },
  segmentedWrap: { flexDirection: "row", backgroundColor: SURFACE_ALT, padding: 4, borderRadius: 18, marginBottom: 20 },
  segmentedButton: { flex: 1, minHeight: 48, borderRadius: 14, alignItems: "center", justifyContent: "center" },
  segmentedButtonActive: { backgroundColor: "#FFFFFF", ...Platform.select({ ios: { shadowColor: "#101828", shadowOpacity: 0.08, shadowRadius: 12, shadowOffset: { width: 0, height: 6 } }, android: { elevation: 2 }, default: {} }) },
  segmentedButtonText: { color: "#647067", fontSize: 14, fontWeight: "700", textTransform: "capitalize" },
  segmentedButtonTextActive: { color: TEXT_DARK },
  sectionStack: { gap: 16 },
  inputBlock: { gap: 8 },
  inputLabel: { fontSize: 12, fontWeight: "700", color: "#5B665F" },
  inputShell: { minHeight: 56, borderRadius: 20, borderWidth: 1, borderColor: BORDER_LIGHT, backgroundColor: SURFACE_SOFT, paddingHorizontal: 14, flexDirection: "row", alignItems: "center", gap: 12 },
  inputShellDisabled: { backgroundColor: "#F3F6F3", borderColor: "#E7ECE8", opacity: 0.75 },
  inputIconWrap: { width: 20, alignItems: "center", justifyContent: "center" },
  inputText: { flex: 1, color: "#1A231D", fontSize: 15, paddingVertical: 16 },
  verifyButton: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 999, backgroundColor: BRAND_GREEN },
  verifyButtonDone: { backgroundColor: "#EAF6EE" },
  verifyButtonText: { color: "#FFFFFF", fontSize: 11, fontWeight: "700" },
  verifyButtonDoneText: { color: BRAND_GREEN },
  iconToggle: { width: 32, height: 32, borderRadius: 16, alignItems: "center", justifyContent: "center" },
  rowBetween: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 },
  rememberRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  rememberBoxOuter: { width: 16, height: 16, borderRadius: 4, borderWidth: 1, borderColor: "#BFD2C3", alignItems: "center", justifyContent: "center", backgroundColor: "#FFFFFF" },
  rememberBoxInner: { width: 8, height: 8, borderRadius: 2, backgroundColor: BRAND_GREEN },
  rememberText: { fontSize: 14, color: "#5E6B63" },
  forgotText: { fontSize: 14, fontWeight: "700", color: BRAND_GREEN },
  feedbackBox: { borderWidth: 1, borderRadius: 18, paddingHorizontal: 14, paddingVertical: 12 },
  feedbackText: { fontSize: 14, fontWeight: "600" },
  successFeedback: { backgroundColor: "#EFF8F1", borderColor: "#D7EAD9" },
  infoFeedback: { backgroundColor: "#EEF6FF", borderColor: "#D8E7FF" },
  errorFeedback: { backgroundColor: "#FFF3F3", borderColor: "#F2D4D4" },
  primaryButton: { minHeight: 56, borderRadius: 20, backgroundColor: BRAND_GREEN, paddingHorizontal: 18, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, ...Platform.select({ ios: { shadowColor: BRAND_GREEN, shadowOpacity: 0.24, shadowRadius: 18, shadowOffset: { width: 0, height: 10 } }, android: { elevation: 6 }, default: {} }) },
  primaryButtonCompact: { width: "72%", minWidth: 0, maxWidth: "72%" },
  primaryButtonFullWidth: { width: "100%" },
  primaryButtonText: { color: "#FFFFFF", fontSize: 16, fontWeight: "700", flexShrink: 1 },
  disabledButton: { opacity: 0.72 },
  stepperWrap: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: 4, paddingHorizontal: 4 },
  stepItem: { flex: 1, alignItems: "center", position: "relative" },
  stepLine: { position: "absolute", left: "50%", top: 16, width: "100%", height: 1.5, backgroundColor: "#DCE6DE" },
  stepCircle: { width: 32, height: 32, borderRadius: 16, borderWidth: 1, borderColor: "#DCE6DE", backgroundColor: "#FFFFFF", alignItems: "center", justifyContent: "center", zIndex: 1 },
  stepCircleActive: { borderColor: BRAND_GREEN, backgroundColor: BRAND_GREEN },
  stepNumber: { color: "#7B867F", fontSize: 12, fontWeight: "700" },
  stepNumberActive: { color: "#FFFFFF" },
  stepLabel: { marginTop: 6, fontSize: 10, fontWeight: "600", color: "#7B867F" },
  stepLabelActive: { color: TEXT_DARK },
  stepLabelDone: { color: BRAND_GREEN },
  stepTitle: { fontSize: 20, fontWeight: "800", color: TEXT_DARK },
  stepSubtitle: { marginTop: 4, fontSize: 14, lineHeight: 21, color: "#738077" },
  selectionBlock: { gap: 8 },
  selectionWrap: { flexDirection: "row", flexWrap: "wrap", gap: 8, backgroundColor: SURFACE_ALT, padding: 6, borderRadius: 20 },
  selectionWrapNoWrap: { flexWrap: "nowrap" },
  selectionButton: { minHeight: 48, borderRadius: 14, alignItems: "center", justifyContent: "center", paddingHorizontal: 12 },
  selectionButtonHalf: { width: "48.6%" },
  selectionButtonThird: { flex: 1, minWidth: 0 },
  selectionButtonFull: { width: "100%" },
  selectionButtonActive: { backgroundColor: "#FFFFFF", ...Platform.select({ ios: { shadowColor: "#101828", shadowOpacity: 0.08, shadowRadius: 12, shadowOffset: { width: 0, height: 6 } }, android: { elevation: 2 }, default: {} }) },
  selectionButtonText: { color: "#647067", fontSize: 14, fontWeight: "700" },
  selectionButtonTextActive: { color: TEXT_DARK },
  locationStack: { gap: 12 },
  signupActions: { flexDirection: "row", alignItems: "stretch", justifyContent: "space-between", gap: 10, width: "100%" },
  secondaryButton: { width: "24%", minWidth: 82, maxWidth: "24%", paddingHorizontal: 12, minHeight: 56, borderRadius: 20, borderWidth: 1, borderColor: "#D9E5DC", backgroundColor: "#FFFFFF", flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6 },
  secondaryButtonText: { color: TEXT_DARK, fontSize: 14, fontWeight: "700" },
  footerPromptRow: { marginTop: 20, flexDirection: "row", alignItems: "center", justifyContent: "center" },
  footerPromptText: { color: TEXT_MUTED, fontSize: 14 },
  footerPromptAction: { color: BRAND_GREEN, fontSize: 14, fontWeight: "700" },
  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.30)", alignItems: "center", justifyContent: "center", paddingHorizontal: 24 },
  modalCard: { width: "100%", maxWidth: 360, borderRadius: 30, borderWidth: 1, borderColor: "rgba(255,255,255,0.85)", backgroundColor: "#FFFFFF", padding: 20, ...shadow },
  modalHeaderRow: { flexDirection: "row", alignItems: "flex-start", gap: 16 },
  modalTitle: { fontSize: 20, fontWeight: "800", color: TEXT_DARK },
  modalSubtitle: { marginTop: 4, fontSize: 14, lineHeight: 20, color: "#738077" },
  modalCloseButton: { width: 36, height: 36, borderRadius: 12, alignItems: "center", justifyContent: "center", backgroundColor: "#F3F6F3" },
  otpRow: { marginTop: 24, flexDirection: "row", alignItems: "center", justifyContent: "center" },
  otpCell: { flexDirection: "row", alignItems: "center", marginHorizontal: 3 },
  otpInput: { width: 40, height: 52, borderRadius: 14, borderWidth: 1, borderColor: BORDER_LIGHT, backgroundColor: SURFACE_SOFT, textAlign: "center", fontSize: 22, fontWeight: "700", color: TEXT_DARK, paddingVertical: 0 },
  otpDivider: { fontSize: 20, fontWeight: "500", color: "#98A39C", marginHorizontal: 4 },
  modalMetaRow: { marginTop: 18, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 16, flexWrap: "wrap" },
  modalLink: { color: TEXT_DARK, fontSize: 14, fontWeight: "700", textDecorationLine: "underline" },
  modalLinkDisabled: { color: "#98A39C", textDecorationLine: "none" },
  modalOtpHint: { color: "#738077", fontSize: 12 },
  modalError: { marginTop: 10, color: "#B42318", fontSize: 14, fontWeight: "600", textAlign: "center" },
  modalActions: { marginTop: 20, flexDirection: "row", gap: 12 },
  modalSecondaryAction: { flex: 1, minHeight: 48, borderRadius: 16, borderWidth: 1, borderColor: "#D9E5DC", backgroundColor: "#F7FAF7", alignItems: "center", justifyContent: "center" },
  modalSecondaryActionText: { color: TEXT_DARK, fontSize: 14, fontWeight: "700" },
  modalPrimaryAction: { flex: 1, minHeight: 48, borderRadius: 16, backgroundColor: BRAND_GREEN, alignItems: "center", justifyContent: "center" },
  modalPrimaryActionText: { color: "#FFFFFF", fontSize: 14, fontWeight: "700" },
});
