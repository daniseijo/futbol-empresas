import { weekdayName } from "@/lib/dates";
import { DEFAULT_SCHEDULE, TIME_OPTIONS, WEEKDAY_OPTIONS, type Schedule } from "@/notify/schedule";

const select = "h-11 w-full rounded-[10px] border border-line bg-surface px-3 text-base";

/** The day and hour of a Slack subscription's call-ups, as `dia` and `hora` form fields. */
export function SlackScheduleFields({ schedule = DEFAULT_SCHEDULE }: { schedule?: Schedule }) {
  return (
    <div className="grid w-full gap-3 sm:grid-cols-[3fr_2fr]">
      <label className="flex flex-col gap-1.5 text-sm font-semibold">
        Día del aviso
        <select name="dia" defaultValue={schedule.weekday} className={select}>
          {WEEKDAY_OPTIONS.map((day) => (
            <option key={day} value={day}>
              El {weekdayName(day)} antes del partido
            </option>
          ))}
        </select>
      </label>
      <label className="flex flex-col gap-1.5 text-sm font-semibold">
        Hora
        <select name="hora" defaultValue={schedule.time} className={select}>
          {TIME_OPTIONS.map((time) => (
            <option key={time} value={time}>
              A las {time}
            </option>
          ))}
        </select>
      </label>
    </div>
  );
}
