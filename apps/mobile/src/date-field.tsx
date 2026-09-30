import { useState } from "react";
import { Platform, Text, View } from "react-native";
import DateTimePicker from "@react-native-community/datetimepicker";
import { formatCivilDate } from "@timely/domain";
import { CalendarDays, Clock3 } from "lucide-react-native";
import { colors } from "@timely/design";
import { Button, s } from "./ui";
/** Date picker values are local civil fields, never UTC string slices. */
export function DateField({
  label,
  value,
  onChange,
  mode = "date",
  onClear,
}: {
  label: string;
  value: string | null;
  onChange: (value: string) => void;
  mode?: "date" | "time";
  onClear?: () => void;
}) {
  const [open, setOpen] = useState(false);
  const selected = new Date();
  if (mode === "date") {
    const [year, month, day] = (value ?? "2000-01-01").split("-").map(Number);
    selected.setFullYear(year!, month! - 1, day!);
    selected.setHours(12, 0, 0, 0);
  } else {
    const [hour, minute] = (value ?? "09:00").split(":").map(Number);
    selected.setHours(hour!, minute!, 0, 0);
  }
  const pad = (n: number) => String(n).padStart(2, "0");
  return (
    <View style={s.field}>
      <Text style={s.label}>{label}</Text>
      <View style={s.row}>
        <Button
          title={
            value && mode === "date"
              ? formatCivilDate(value, {
                  day: "numeric",
                  month: "short",
                  year: "numeric",
                })
              : (value ?? (mode === "time" ? "Any time" : "Choose date"))
          }
          label={`Choose ${label.toLowerCase()}`}
          onPress={() => setOpen(true)}
        >
          {mode === "date" ? (
            <CalendarDays size={18} color={colors.muted} />
          ) : (
            <Clock3 size={18} color={colors.muted} />
          )}
        </Button>
        {value !== null && onClear && (
          <Button
            title="Clear"
            label={`Clear ${label.toLowerCase()}`}
            onPress={onClear}
          />
        )}
      </View>
      {open && (
        <>
          <DateTimePicker
            value={selected}
            mode={mode}
            display={Platform.OS === "ios" ? "spinner" : "default"}
            minimumDate={mode === "date" ? new Date(1900, 0, 1) : undefined}
            maximumDate={mode === "date" ? new Date(2100, 11, 31) : undefined}
            onChange={(event, next) => {
              if (Platform.OS !== "ios") setOpen(false);
              if (event.type === "set" && next)
                onChange(
                  mode === "date"
                    ? `${next.getFullYear()}-${pad(next.getMonth() + 1)}-${pad(next.getDate())}`
                    : `${pad(next.getHours())}:${pad(next.getMinutes())}`,
                );
            }}
          />
          {Platform.OS === "ios" && (
            <Button title="Done" onPress={() => setOpen(false)} />
          )}
        </>
      )}
    </View>
  );
}
