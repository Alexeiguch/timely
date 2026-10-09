import { t, locale } from "@timely/i18n";
import { useLanguage } from "./language-state";
import type { ReactNode } from "react";
import {
  ActivityIndicator,
  Modal,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  type TextInputProps,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import { X, Check } from "lucide-react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import {
  colors,
  surfaces,
  nativeTypography as type,
  radius,
} from "@timely/design";
export function Button({
  title,
  onPress,
  active = false,
  disabled = false,
  loading = false,
  label,
  variant = "secondary",
  style,
  children,
}: {
  title: string;
  onPress: () => void;
  active?: boolean;
  disabled?: boolean;
  loading?: boolean;
  label?: string;
  variant?: "primary" | "secondary" | "ghost" | "destructive";
  style?: StyleProp<ViewStyle>;
  children?: ReactNode;
}) {
  useLanguage();
  const filled = active || variant === "primary";
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label ?? title}
      accessibilityState={{
        selected: active,
        disabled: disabled || loading,
        busy: loading,
      }}
      disabled={disabled || loading}
      onPress={onPress}
      style={({ pressed }) => [
        s.button,
        variant === "ghost" && s.ghost,
        filled && s.active,
        disabled && s.disabled,
        pressed && s.pressed,
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={filled ? colors.surface : colors.primary} />
      ) : (
        children
      )}
      <Text
        style={[
          s.buttonText,
          variant === "ghost" && s.link,
          variant === "destructive" && s.danger,
          filled && s.activeText,
        ]}
      >
        {title}
      </Text>
    </Pressable>
  );
}
export function IconButton({
  label,
  onPress,
  children,
}: {
  label: string;
  onPress: () => void;
  children: ReactNode;
}) {
  useLanguage();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={({ pressed }) => [s.iconButton, pressed && s.pressed]}
    >
      {children}
    </Pressable>
  );
}
export function Field({
  label,
  ...props
}: TextInputProps & {
  label: string;
}) {
  useLanguage();
  return (
    <View style={s.field}>
      <Text style={s.label}>{label}</Text>
      <TextInput
        {...props}
        accessibilityLabel={label}
        placeholderTextColor={colors.muted}
        selectionColor={colors.primary}
        style={[s.input, props.multiline && s.multiline, props.style]}
      />
    </View>
  );
}
export function Choices<T extends string | number>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: Array<{
    value: T;
    label: string;
  }>;
  onChange: (value: T) => void;
}) {
  return (
    <View style={s.field}>
      <Text style={s.label}>{label}</Text>
      <View style={s.row}>
        {options.map((option) => (
          <Pressable
            key={option.value}
            accessibilityRole="button"
            accessibilityLabel={`${label}: ${option.label}`}
            accessibilityState={{ selected: value === option.value }}
            onPress={() => onChange(option.value)}
            style={({ pressed }) => [
              s.chip,
              value === option.value && s.selectedChip,
              pressed && s.pressed,
            ]}
          >
            {value === option.value && (
              <Check size={16} color={colors.primary} />
            )}
            <Text style={[s.buttonText, value === option.value && s.link]}>
              {option.label}
            </Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}
export function Segmented<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: T[];
  onChange: (value: T) => void;
}) {
  useLanguage();
  return (
    <View style={s.segment}>
      {options.map((option) => (
        <Pressable
          key={option}
          accessibilityRole="button"
          accessibilityLabel={`${label}: ${t(option)}`}
          accessibilityState={{ selected: value === option }}
          onPress={() => onChange(option)}
          style={({ pressed }) => [
            s.segmentItem,
            value === option && s.segmentSelected,
            pressed && s.pressed,
          ]}
        >
          <Text style={[s.buttonText, value === option && s.activeText]}>
            {t(option)}
          </Text>
        </Pressable>
      ))}
    </View>
  );
}
export function Sheet({
  title,
  onClose,
  children,
  footer,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
}) {
  useLanguage();
  return (
    <Modal
      visible
      animationType="none"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <SafeAreaView style={s.screen}>
        <KeyboardAvoidingView
          style={s.screen}
          behavior={Platform.OS === "ios" ? "padding" : "height"}
        >
          <View style={s.sheetHeader}>
            <Text style={[s.section, s.grow]} accessibilityRole="header">
              {title}
            </Text>
            <IconButton label={t("Close")} onPress={onClose}>
              <X size={22} color={colors.text} />
            </IconButton>
          </View>
          <ScrollView
            contentContainerStyle={s.page}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="on-drag"
            automaticallyAdjustKeyboardInsets
          >
            {children}
          </ScrollView>
          {footer && <View style={s.sheetFooter}>{footer}</View>}
        </KeyboardAvoidingView>
      </SafeAreaView>
    </Modal>
  );
}
export const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  page: { padding: 20, gap: 24, paddingBottom: 32 },
  row: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 8 },
  grow: { flex: 1, minWidth: 0 },
  field: { gap: 8 },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.card,
    borderCurve: "continuous",
    padding: 20,
    gap: 12,
  },
  heading: { ...type.heading, color: colors.text },
  section: { ...type.section, color: colors.text },
  title: { ...type.title, color: colors.text },
  body: { ...type.body, color: colors.text },
  muted: { ...type.caption, color: colors.muted },
  label: { ...type.label, color: colors.text },
  input: {
    minHeight: 52,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: surfaces.inputBorder,
    borderRadius: radius.small,
    padding: 16,
    ...type.body,
    color: colors.text,
  },
  multiline: { minHeight: 100, textAlignVertical: "top" },
  button: {
    minHeight: 48,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: radius.medium,
    borderCurve: "continuous",
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: surfaces.border,
    justifyContent: "center",
    alignItems: "center",
    flexDirection: "row",
    gap: 8,
  },
  buttonText: {
    ...type.label,
    color: colors.text,
    textAlign: "center",
    flexShrink: 1,
  },
  ghost: {
    backgroundColor: "transparent",
    borderColor: "transparent",
    paddingHorizontal: 8,
  },
  link: { color: colors.primary },
  onAccent: { color: colors.text },
  danger: { color: surfaces.danger },
  active: { backgroundColor: colors.primary, borderColor: colors.primary },
  activeText: { color: colors.surface },
  disabled: { backgroundColor: surfaces.neutral },
  pressed: { opacity: 0.72 },
  notice: {
    backgroundColor: colors.lime,
    padding: 16,
    borderRadius: radius.medium,
    gap: 8,
  },
  error: {
    backgroundColor: surfaces.orange,
    padding: 16,
    borderRadius: radius.medium,
  },
  brand: { fontFamily: "Baloo2", fontSize: 32, color: colors.primary },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: surfaces.border,
  },
  center: { alignItems: "center", justifyContent: "center" },
  iconButton: {
    width: 48,
    minHeight: 48,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radius.pill,
    backgroundColor: surfaces.neutral,
  },
  chip: {
    minHeight: 48,
    borderRadius: radius.pill,
    paddingHorizontal: 16,
    paddingVertical: 12,
    flexDirection: "row",
    gap: 4,
    alignItems: "center",
    borderWidth: 1,
    borderColor: surfaces.border,
    backgroundColor: colors.surface,
  },
  selectedChip: { backgroundColor: surfaces.blue, borderColor: colors.primary },
  segment: {
    flexDirection: "row",
    backgroundColor: surfaces.neutral,
    padding: 4,
    borderRadius: radius.medium,
    gap: 4,
  },
  segmentItem: {
    flex: 1,
    minHeight: 48,
    alignItems: "center",
    justifyContent: "center",
    padding: 8,
    borderRadius: radius.small,
  },
  segmentSelected: { backgroundColor: colors.primary },
  sheetHeader: {
    flexDirection: "row",
    gap: 12,
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: surfaces.border,
  },
  sheetFooter: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: surfaces.border,
    backgroundColor: colors.background,
  },
});
