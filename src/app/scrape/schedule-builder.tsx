"use client";

import { useEffect, useState } from "react";
import { describeSchedule } from "@/lib/utils/schedule-utils";
import styles from "./page.module.css";

interface ScheduleBuilderProps {
  initialInterval?: number | null;
  initialCron?: string | null;
  onChange: (value: {
    scheduleInterval: number | null;
    scheduleCron: string | null;
  }) => void;
}

const DAYS = [
  { label: "Su", value: 0 },
  { label: "Mo", value: 1 },
  { label: "Tu", value: 2 },
  { label: "We", value: 3 },
  { label: "Th", value: 4 },
  { label: "Fr", value: 5 },
  { label: "Sa", value: 6 },
];

function parseInitialState(
  initialInterval: number | null | undefined,
  initialCron: string | null | undefined,
) {
  if (initialCron) {
    const parts = initialCron.trim().split(/\s+/);
    if (parts.length === 5) {
      const [min, hour, dom, month, dow] = parts;

      // Weekly: "MM HH * * DOW" where DOW !== "*"
      if (
        !min.includes(",") &&
        !min.includes("/") &&
        !min.includes("*") &&
        !hour.includes(",") &&
        !hour.includes("/") &&
        !hour.includes("*") &&
        dom === "*" &&
        month === "*" &&
        dow !== "*"
      ) {
        const parsedMin = parseInt(min, 10);
        const parsedHour = parseInt(hour, 10);
        const time = `${String(parsedHour).padStart(2, "0")}:${String(parsedMin).padStart(2, "0")}`;
        const dayStrings = dow.split(",");
        const days = dayStrings.map((d) => {
          const lower = d.toLowerCase();
          if (lower === "sun" || lower === "0" || lower === "7") return 0;
          if (lower === "mon" || lower === "1") return 1;
          if (lower === "tue" || lower === "2") return 2;
          if (lower === "wed" || lower === "3") return 3;
          if (lower === "thu" || lower === "4") return 4;
          if (lower === "fri" || lower === "5") return 5;
          if (lower === "sat" || lower === "6") return 6;
          const parsed = parseInt(d, 10);
          return Number.isNaN(parsed) ? 0 : parsed % 7;
        });
        return {
          frequency: "weekly" as const,
          weeklyDays: days,
          time,
          hourInterval: 1,
          minute: 0,
          dayInterval: 1,
          intervalValue: 5,
          intervalUnit: "minutes" as const,
          cronPattern: initialCron,
        };
      }

      // Daily: "MM HH */N * *" or "MM HH * * *"
      if (
        !min.includes(",") &&
        !min.includes("/") &&
        !min.includes("*") &&
        !hour.includes(",") &&
        !hour.includes("/") &&
        !hour.includes("*") &&
        month === "*" &&
        dow === "*"
      ) {
        const parsedMin = parseInt(min, 10);
        const parsedHour = parseInt(hour, 10);
        const time = `${String(parsedHour).padStart(2, "0")}:${String(parsedMin).padStart(2, "0")}`;
        let dayInterval = 1;
        if (dom.startsWith("*/")) {
          dayInterval = parseInt(dom.substring(2), 10) || 1;
        }
        return {
          frequency: "daily" as const,
          dayInterval,
          time,
          hourInterval: 1,
          minute: 0,
          weeklyDays: [1],
          intervalValue: 5,
          intervalUnit: "minutes" as const,
          cronPattern: initialCron,
          monthlyOption: "first" as const,
          monthlyDay: 1,
        };
      }

      // Monthly: "MM HH DOM * *"
      if (
        !min.includes(",") &&
        !min.includes("/") &&
        !min.includes("*") &&
        !hour.includes(",") &&
        !hour.includes("/") &&
        !hour.includes("*") &&
        dom !== "*" &&
        month === "*" &&
        dow === "*"
      ) {
        const parsedMin = parseInt(min, 10);
        const parsedHour = parseInt(hour, 10);
        const time = `${String(parsedHour).padStart(2, "0")}:${String(parsedMin).padStart(2, "0")}`;

        let monthlyOption: "first" | "middle" | "last" | "specific" =
          "specific";
        let monthlyDay = 1;
        if (dom === "1") {
          monthlyOption = "first";
        } else if (dom === "15") {
          monthlyOption = "middle";
        } else if (dom === "L") {
          monthlyOption = "last";
        } else {
          monthlyOption = "specific";
          monthlyDay = parseInt(dom, 10) || 1;
        }

        return {
          frequency: "monthly" as const,
          monthlyOption,
          monthlyDay,
          time,
          hourInterval: 1,
          minute: 0,
          dayInterval: 1,
          weeklyDays: [1],
          intervalValue: 5,
          intervalUnit: "minutes" as const,
          cronPattern: initialCron,
        };
      }

      // Hourly: "MM */N * * *" or "MM * * * *"
      if (
        !min.includes(",") &&
        !min.includes("/") &&
        !min.includes("*") &&
        dom === "*" &&
        month === "*" &&
        dow === "*"
      ) {
        const minute = parseInt(min, 10);
        let hourInterval = 1;
        if (hour.startsWith("*/")) {
          hourInterval = parseInt(hour.substring(2), 10) || 1;
        } else if (hour === "*") {
          hourInterval = 1;
        }
        return {
          frequency: "hourly" as const,
          hourInterval,
          minute,
          dayInterval: 1,
          time: "12:00",
          weeklyDays: [1],
          intervalValue: 5,
          intervalUnit: "minutes" as const,
          cronPattern: initialCron,
          monthlyOption: "first" as const,
          monthlyDay: 1,
        };
      }
    }

    // Fallback to advanced cron
    return {
      frequency: "advanced" as const,
      cronPattern: initialCron,
      hourInterval: 1,
      minute: 0,
      dayInterval: 1,
      time: "12:00",
      weeklyDays: [1],
      intervalValue: 5,
      intervalUnit: "minutes" as const,
      monthlyOption: "first" as const,
      monthlyDay: 1,
    };
  }

  if (initialInterval) {
    let value = initialInterval;
    let unit: "seconds" | "minutes" | "hours" | "days" = "seconds";

    if (initialInterval % 86400 === 0) {
      value = initialInterval / 86400;
      unit = "days";
    } else if (initialInterval % 3600 === 0) {
      value = initialInterval / 3600;
      unit = "hours";
    } else if (initialInterval % 60 === 0) {
      value = initialInterval / 60;
      unit = "minutes";
    }

    return {
      frequency: "interval" as const,
      intervalValue: value,
      intervalUnit: unit,
      hourInterval: 1,
      minute: 0,
      dayInterval: 1,
      time: "12:00",
      weeklyDays: [1],
      cronPattern: "0 0 * * *",
      monthlyOption: "first" as const,
      monthlyDay: 1,
    };
  }

  return {
    frequency: "manual" as const,
    hourInterval: 1,
    minute: 0,
    dayInterval: 1,
    time: "12:00",
    weeklyDays: [1],
    intervalValue: 5,
    intervalUnit: "minutes" as const,
    cronPattern: "0 0 * * *",
    monthlyOption: "first" as const,
    monthlyDay: 1,
  };
}

export default function ScheduleBuilder({
  initialInterval,
  initialCron,
  onChange,
}: ScheduleBuilderProps) {
  const [mounted, setMounted] = useState(false);

  // Initialize state once parsed from initial values
  const [frequency, setFrequency] = useState<
    | "manual"
    | "hourly"
    | "daily"
    | "weekly"
    | "monthly"
    | "interval"
    | "advanced"
  >("manual");
  const [hourInterval, setHourInterval] = useState(1);
  const [hourMinute, setHourMinute] = useState(0);
  const [dayInterval, setDayInterval] = useState(1);
  const [time, setTime] = useState("12:00");
  const [weeklyDays, setWeeklyDays] = useState<number[]>([1]);
  const [monthlyOption, setMonthlyOption] = useState<
    "first" | "middle" | "last" | "specific"
  >("first");
  const [monthlyDay, setMonthlyDay] = useState(1);
  const [intervalValue, setIntervalValue] = useState(5);
  const [intervalUnit, setIntervalUnit] = useState<
    "seconds" | "minutes" | "hours" | "days"
  >("minutes");
  const [cronPattern, setCronPattern] = useState("0 0 * * *");
  const [showAdvancedEscape, setShowAdvancedEscape] = useState(false);

  // Load and parse initial values once on mount
  useEffect(() => {
    const initialState = parseInitialState(initialInterval, initialCron);
    setFrequency(initialState.frequency);
    setHourInterval(initialState.hourInterval);
    setHourMinute(initialState.minute);
    setDayInterval(initialState.dayInterval);
    setTime(initialState.time);
    setWeeklyDays(initialState.weeklyDays);
    setMonthlyOption(initialState.monthlyOption ?? "first");
    setMonthlyDay(initialState.monthlyDay ?? 1);
    setIntervalValue(initialState.intervalValue);
    setIntervalUnit(initialState.intervalUnit);
    setCronPattern(initialState.cronPattern);

    if (initialState.frequency === "advanced") {
      setShowAdvancedEscape(true);
    }

    setMounted(true);
  }, [initialInterval, initialCron]);

  // Compute cron/interval whenever inputs change and call onChange
  useEffect(() => {
    if (!mounted) return;

    let scheduleInterval: number | null = null;
    let scheduleCron: string | null = null;

    const [hourStr, minStr] = time.split(":");
    const parsedHour = parseInt(hourStr || "0", 10);
    const parsedMin = parseInt(minStr || "0", 10);

    switch (frequency) {
      case "manual":
        scheduleInterval = null;
        scheduleCron = null;
        break;
      case "hourly":
        scheduleInterval = null;
        scheduleCron = `${hourMinute} */${hourInterval} * * *`;
        break;
      case "daily":
        scheduleInterval = null;
        scheduleCron = `${parsedMin} ${parsedHour} */${dayInterval} * *`;
        break;
      case "weekly": {
        const sortedDays = [...weeklyDays].sort((a, b) => a - b);
        const dowString = sortedDays.length > 0 ? sortedDays.join(",") : "0";
        scheduleInterval = null;
        scheduleCron = `${parsedMin} ${parsedHour} * * ${dowString}`;
        break;
      }
      case "monthly": {
        let domPattern = "1";
        if (monthlyOption === "first") domPattern = "1";
        else if (monthlyOption === "middle") domPattern = "15";
        else if (monthlyOption === "last") domPattern = "L";
        else domPattern = String(Math.max(1, Math.min(31, monthlyDay)));

        scheduleInterval = null;
        scheduleCron = `${parsedMin} ${parsedHour} ${domPattern} * *`;
        break;
      }
      case "interval": {
        let multiplier = 1;
        if (intervalUnit === "minutes") multiplier = 60;
        else if (intervalUnit === "hours") multiplier = 3600;
        else if (intervalUnit === "days") multiplier = 86400;

        scheduleInterval = Math.max(1, intervalValue) * multiplier;
        scheduleCron = null;
        break;
      }
      case "advanced":
        scheduleInterval = null;
        scheduleCron = cronPattern.trim();
        break;
    }

    onChange({ scheduleInterval, scheduleCron });
  }, [
    mounted,
    frequency,
    hourInterval,
    hourMinute,
    dayInterval,
    time,
    weeklyDays,
    monthlyOption,
    monthlyDay,
    intervalValue,
    intervalUnit,
    cronPattern,
    onChange,
  ]);

  if (!mounted) {
    return <div style={{ minHeight: "100px" }}>Loading schedule...</div>;
  }

  const toggleDay = (day: number) => {
    setWeeklyDays((prev) =>
      prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day],
    );
  };

  // Live human-readable summary
  let currentInterval: number | null = null;
  let currentCron: string | null = null;

  const [hourStr, minStr] = time.split(":");
  const parsedHour = parseInt(hourStr || "0", 10);
  const parsedMin = parseInt(minStr || "0", 10);

  if (frequency === "hourly") {
    currentCron = `${hourMinute} */${hourInterval} * * *`;
  } else if (frequency === "daily") {
    currentCron = `${parsedMin} ${parsedHour} */${dayInterval} * *`;
  } else if (frequency === "weekly") {
    const dowString = weeklyDays.length > 0 ? weeklyDays.sort().join(",") : "0";
    currentCron = `${parsedMin} ${parsedHour} * * ${dowString}`;
  } else if (frequency === "monthly") {
    let domPattern = "1";
    if (monthlyOption === "first") domPattern = "1";
    else if (monthlyOption === "middle") domPattern = "15";
    else if (monthlyOption === "last") domPattern = "L";
    else domPattern = String(Math.max(1, Math.min(31, monthlyDay)));
    currentCron = `${parsedMin} ${parsedHour} ${domPattern} * *`;
  } else if (frequency === "interval") {
    let multiplier = 1;
    if (intervalUnit === "minutes") multiplier = 60;
    else if (intervalUnit === "hours") multiplier = 3600;
    else if (intervalUnit === "days") multiplier = 86400;
    currentInterval = Math.max(1, intervalValue) * multiplier;
  } else if (frequency === "advanced") {
    currentCron = cronPattern;
  }

  const summary = describeSchedule(currentInterval, currentCron);

  return (
    <div className={styles.scheduleBuilderContainer}>
      <div className={styles.scheduleBuilderHeader}>
        <span className={styles.scheduleBuilderTitle}>Run Schedule</span>
        {frequency !== "advanced" && (
          <button
            type="button"
            className={styles.advancedHatchToggle}
            onClick={() => {
              setFrequency("advanced");
              setShowAdvancedEscape(true);
            }}
          >
            Use Custom Cron
          </button>
        )}
        {frequency === "advanced" && !initialCron && (
          <button
            type="button"
            className={styles.advancedHatchToggle}
            onClick={() => {
              setFrequency("manual");
              setShowAdvancedEscape(false);
            }}
          >
            Use Guided Builder
          </button>
        )}
      </div>

      <div className={styles.scheduleRow}>
        <div className={styles.scheduleCol} style={{ flex: "0 0 200px" }}>
          <label htmlFor="frequency-select" className={styles.label}>
            Frequency Type
          </label>
          <select
            id="frequency-select"
            value={frequency}
            onChange={(e) => {
              const val = e.target.value as
                | "manual"
                | "hourly"
                | "daily"
                | "weekly"
                | "monthly"
                | "interval"
                | "advanced";
              setFrequency(val);
              if (val === "advanced") {
                setShowAdvancedEscape(true);
              }
            }}
            className={styles.select}
          >
            <option value="manual">Manual (On-Demand Only)</option>
            <option value="hourly">Hourly Interval</option>
            <option value="daily">Daily / Multi-Day Interval</option>
            <option value="weekly">Weekly Schedule</option>
            <option value="monthly">Monthly Schedule</option>
            <option value="interval">Time Delta (Seconds/Minutes...)</option>
            {showAdvancedEscape && (
              <option value="advanced">Advanced (Cron Pattern)</option>
            )}
          </select>
        </div>

        {/* Hourly Inputs */}
        {frequency === "hourly" && (
          <>
            <div className={styles.scheduleCol}>
              <label htmlFor="hourly-interval-input" className={styles.label}>
                Every N Hours
              </label>
              <input
                id="hourly-interval-input"
                type="number"
                min="1"
                max="23"
                value={hourInterval}
                onChange={(e) =>
                  setHourInterval(
                    Math.max(1, parseInt(e.target.value, 10) || 1),
                  )
                }
                className={styles.input}
              />
            </div>
            <div className={styles.scheduleCol}>
              <label htmlFor="hourly-minute-input" className={styles.label}>
                At Minute
              </label>
              <input
                id="hourly-minute-input"
                type="number"
                min="0"
                max="59"
                value={hourMinute}
                onChange={(e) =>
                  setHourMinute(
                    Math.max(
                      0,
                      Math.min(59, parseInt(e.target.value, 10) || 0),
                    ),
                  )
                }
                className={styles.input}
              />
            </div>
          </>
        )}

        {/* Daily Inputs */}
        {frequency === "daily" && (
          <>
            <div className={styles.scheduleCol}>
              <label htmlFor="daily-interval-input" className={styles.label}>
                Every N Days
              </label>
              <input
                id="daily-interval-input"
                type="number"
                min="1"
                max="365"
                value={dayInterval}
                onChange={(e) =>
                  setDayInterval(Math.max(1, parseInt(e.target.value, 10) || 1))
                }
                className={styles.input}
              />
            </div>
            <div className={styles.scheduleCol}>
              <label htmlFor="daily-time-input" className={styles.label}>
                At Time (HH:MM)
              </label>
              <input
                id="daily-time-input"
                type="time"
                value={time}
                onChange={(e) => setTime(e.target.value || "12:00")}
                className={styles.input}
              />
            </div>
          </>
        )}

        {/* Weekly Inputs */}
        {frequency === "weekly" && (
          <>
            <div
              className={styles.scheduleCol}
              style={{ flex: "2 1 auto", minWidth: "220px" }}
            >
              <span className={styles.label}>On Selected Days</span>
              <div className={styles.daysGrid}>
                {DAYS.map((day) => {
                  const isActive = weeklyDays.includes(day.value);
                  return (
                    <button
                      key={day.value}
                      type="button"
                      onClick={() => toggleDay(day.value)}
                      className={`${styles.dayBtn} ${isActive ? styles.dayBtnActive : ""}`}
                    >
                      {day.label}
                    </button>
                  );
                })}
              </div>
            </div>
            <div className={styles.scheduleCol}>
              <label htmlFor="weekly-time-input" className={styles.label}>
                At Time (HH:MM)
              </label>
              <input
                id="weekly-time-input"
                type="time"
                value={time}
                onChange={(e) => setTime(e.target.value || "12:00")}
                className={styles.input}
              />
            </div>
          </>
        )}

        {/* Monthly Inputs */}
        {frequency === "monthly" && (
          <>
            <div
              className={styles.scheduleCol}
              style={{ flex: "1.5 1 auto", minWidth: "180px" }}
            >
              <label htmlFor="monthly-option-select" className={styles.label}>
                Monthly Day Option
              </label>
              <select
                id="monthly-option-select"
                value={monthlyOption}
                onChange={(e) =>
                  setMonthlyOption(
                    e.target.value as "first" | "middle" | "last" | "specific",
                  )
                }
                className={styles.select}
              >
                <option value="first">First day of the month (1st)</option>
                <option value="middle">Middle of the month (15th)</option>
                <option value="last">Last day of the month</option>
                <option value="specific">Specific day of the month...</option>
              </select>
            </div>
            {monthlyOption === "specific" && (
              <div className={styles.scheduleCol}>
                <label htmlFor="monthly-day-input" className={styles.label}>
                  Day of Month (1-31)
                </label>
                <input
                  id="monthly-day-input"
                  type="number"
                  min="1"
                  max="31"
                  value={monthlyDay}
                  onChange={(e) =>
                    setMonthlyDay(
                      Math.max(
                        1,
                        Math.min(31, parseInt(e.target.value, 10) || 1),
                      ),
                    )
                  }
                  className={styles.input}
                />
              </div>
            )}
            <div className={styles.scheduleCol}>
              <label htmlFor="monthly-time-input" className={styles.label}>
                At Time (HH:MM)
              </label>
              <input
                id="monthly-time-input"
                type="time"
                value={time}
                onChange={(e) => setTime(e.target.value || "12:00")}
                className={styles.input}
              />
            </div>
            {monthlyOption === "specific" && monthlyDay > 28 && (
              <div
                className={styles.scheduleWarning}
                style={{ flex: "1 0 100%", marginTop: "0.5rem" }}
              >
                ⚠️ <strong>Warning:</strong> Day {monthlyDay} is greater than 28.
                This schedule will not fire in months with fewer days (e.g.,
                February). Use the <strong>"Last day of the month"</strong>{" "}
                option if you want it to run at the end of every month.
              </div>
            )}
          </>
        )}

        {/* Time Delta Inputs */}
        {frequency === "interval" && (
          <>
            <div className={styles.scheduleCol}>
              <label htmlFor="interval-duration-input" className={styles.label}>
                Interval Duration
              </label>
              <input
                id="interval-duration-input"
                type="number"
                min="1"
                value={intervalValue}
                onChange={(e) =>
                  setIntervalValue(
                    Math.max(1, parseInt(e.target.value, 10) || 1),
                  )
                }
                className={styles.input}
              />
            </div>
            <div className={styles.scheduleCol}>
              <label htmlFor="interval-unit-select" className={styles.label}>
                Unit
              </label>
              <select
                id="interval-unit-select"
                value={intervalUnit}
                onChange={(e) =>
                  setIntervalUnit(
                    e.target.value as "seconds" | "minutes" | "hours" | "days",
                  )
                }
                className={styles.select}
              >
                <option value="seconds">Seconds</option>
                <option value="minutes">Minutes</option>
                <option value="hours">Hours</option>
                <option value="days">Days</option>
              </select>
            </div>
          </>
        )}

        {/* Advanced Cron Inputs */}
        {frequency === "advanced" && (
          <div className={styles.scheduleCol} style={{ flex: "1 1 auto" }}>
            <label htmlFor="cron-pattern-input" className={styles.label}>
              Cron Expression (5-field or 6-field)
            </label>
            <input
              id="cron-pattern-input"
              type="text"
              value={cronPattern}
              onChange={(e) => setCronPattern(e.target.value)}
              placeholder="e.g. 0 */2 * * * (Every 2 hours)"
              className={styles.input}
            />
          </div>
        )}
      </div>

      <div className={styles.scheduleSummary}>
        <strong>Schedule Description:</strong> {summary}
      </div>
    </div>
  );
}
