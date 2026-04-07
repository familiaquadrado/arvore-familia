import { useMemo } from "react";
import type { PeopleMap } from "../types";

type BirthdayCalendarViewProps = {
  people: PeopleMap;
  onBack: () => void;
  onOpenPerson: (personId: string) => void;
};

type BirthdayEntry = {
  id: string;
  fullName: string;
  birthDate: string;
  day: number;
  month: number;
  year: number | null;
  nextBirthday: Date;
  ageTurning: number | null;
  daysUntil: number;
};

const MONTH_NAMES = [
  "Janeiro",
  "Fevereiro",
  "Março",
  "Abril",
  "Maio",
  "Junho",
  "Julho",
  "Agosto",
  "Setembro",
  "Outubro",
  "Novembro",
  "Dezembro",
];

function normalizeText(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function parseBirthday(value: string): { day: number; month: number; year: number | null } | null {
  const text = (value || "").trim();
  if (!text || text === "—") return null;

  const directMatch = text.match(/^(\d{1,2})[\/\-.](\d{1,2})(?:[\/\-.](\d{2,4}))?$/);
  if (directMatch) {
    const day = Number(directMatch[1]);
    const month = Number(directMatch[2]);
    const year = directMatch[3] ? Number(directMatch[3]) : null;

    if (day >= 1 && day <= 31 && month >= 1 && month <= 12) {
      return { day, month, year };
    }
  }

  const normalized = normalizeText(text);

  const monthMap: Record<string, number> = {
    janeiro: 1,
    fevereiro: 2,
    marco: 3,
    abril: 4,
    maio: 5,
    junho: 6,
    julho: 7,
    agosto: 8,
    setembro: 9,
    outubro: 10,
    novembro: 11,
    dezembro: 12,
  };

  const monthName = Object.keys(monthMap).find((name) => normalized.includes(name));
  const dayMatch = normalized.match(/\b(\d{1,2})\b/);
  const yearMatch = normalized.match(/\b(1[5-9]\d{2}|20\d{2}|21\d{2})\b/);

  if (monthName && dayMatch) {
    const day = Number(dayMatch[1]);
    const month = monthMap[monthName];
    const year = yearMatch ? Number(yearMatch[1]) : null;

    if (day >= 1 && day <= 31) {
      return { day, month, year };
    }
  }

  return null;
}

function buildNextBirthday(day: number, month: number, today: Date): Date {
  const currentYear = today.getFullYear();
  const birthdayThisYear = new Date(currentYear, month - 1, day);
  birthdayThisYear.setHours(0, 0, 0, 0);

  const todayCopy = new Date(today);
  todayCopy.setHours(0, 0, 0, 0);

  if (birthdayThisYear >= todayCopy) {
    return birthdayThisYear;
  }

  return new Date(currentYear + 1, month - 1, day);
}

function getDaysUntil(target: Date, today: Date): number {
  const oneDay = 1000 * 60 * 60 * 24;
  const start = new Date(today);
  start.setHours(0, 0, 0, 0);

  const end = new Date(target);
  end.setHours(0, 0, 0, 0);

  return Math.round((end.getTime() - start.getTime()) / oneDay);
}

function formatBirthdayLabel(day: number, month: number): string {
  return `${String(day).padStart(2, "0")}/${String(month).padStart(2, "0")}`;
}

function formatDaysUntil(daysUntil: number): string {
  if (daysUntil === 0) return "Hoje";
  if (daysUntil === 1) return "Amanhã";
  return `Faltam ${daysUntil} dias`;
}

function sectionTitleForMonth(month: number): string {
  return MONTH_NAMES[month - 1] || `Mês ${month}`;
}

function BirthdayCard({
  entry,
  onOpenPerson,
}: {
  entry: BirthdayEntry;
  onOpenPerson: (personId: string) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onOpenPerson(entry.id)}
      style={{
        width: "100%",
        textAlign: "left",
        border: "1px solid #e7e5e4",
        background: "white",
        borderRadius: 18,
        padding: 14,
        cursor: "pointer",
      }}
    >
      <div style={{ fontWeight: 700, color: "#1c1917", marginBottom: 6 }}>{entry.fullName}</div>

      <div style={{ color: "#57534e", fontSize: 14 }}>
        Aniversário: {formatBirthdayLabel(entry.day, entry.month)}
      </div>

      <div style={{ color: "#57534e", fontSize: 14, marginTop: 4 }}>
        {formatDaysUntil(entry.daysUntil)}
        {entry.ageTurning !== null ? ` • Faz ${entry.ageTurning} anos` : ""}
      </div>
    </button>
  );
}

export default function BirthdayCalendarView({
  people,
  onBack,
  onOpenPerson,
}: BirthdayCalendarViewProps) {
  const { todayBirthdays, nextThirtyDays, byMonth } = useMemo(() => {
    const today = new Date();

    const allEntries: BirthdayEntry[] = Object.values(people)
      .map((person) => {
        const parsed = parseBirthday(person.birthDate);
        if (!parsed) return null;

        const nextBirthday = buildNextBirthday(parsed.day, parsed.month, today);
        const daysUntil = getDaysUntil(nextBirthday, today);

        return {
          id: person.id,
          fullName: person.fullName,
          birthDate: person.birthDate,
          day: parsed.day,
          month: parsed.month,
          year: parsed.year,
          nextBirthday,
          ageTurning: parsed.year ? nextBirthday.getFullYear() - parsed.year : null,
          daysUntil,
        } satisfies BirthdayEntry;
      })
      .filter((entry): entry is BirthdayEntry => Boolean(entry))
      .sort((a, b) => {
        if (a.daysUntil !== b.daysUntil) return a.daysUntil - b.daysUntil;
        if (a.month !== b.month) return a.month - b.month;
        if (a.day !== b.day) return a.day - b.day;
        return a.fullName.localeCompare(b.fullName, "pt");
      });

    const todayBirthdays = allEntries.filter((entry) => entry.daysUntil === 0);
    const nextThirtyDays = allEntries.filter((entry) => entry.daysUntil >= 0 && entry.daysUntil <= 30);

    const byMonth: Record<number, BirthdayEntry[]> = {};
    for (let month = 1; month <= 12; month += 1) {
      byMonth[month] = allEntries
        .filter((entry) => entry.month === month)
        .sort((a, b) => {
          if (a.day !== b.day) return a.day - b.day;
          return a.fullName.localeCompare(b.fullName, "pt");
        });
    }

    return { todayBirthdays, nextThirtyDays, byMonth };
  }, [people]);

  return (
    <div
      style={{
        background: "white",
        border: "1px solid #e7e5e4",
        borderRadius: 24,
        padding: 24,
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 16,
          flexWrap: "wrap",
          marginBottom: 24,
        }}
      >
        <div>
          <div
            style={{
              fontSize: 12,
              textTransform: "uppercase",
              letterSpacing: "0.18em",
              color: "#92400e",
              marginBottom: 8,
            }}
          >
            Calendário familiar
          </div>

          <h2 style={{ margin: 0 }}>Aniversários</h2>
        </div>

        <button
          onClick={onBack}
          style={{
            border: "1px solid #d6d3d1",
            background: "white",
            borderRadius: 14,
            padding: "10px 14px",
            cursor: "pointer",
          }}
        >
          ← Voltar
        </button>
      </div>

      <section style={{ marginBottom: 28 }}>
        <h3 style={{ marginTop: 0 }}>Hoje</h3>

        {todayBirthdays.length ? (
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
              gap: 14,
            }}
          >
            {todayBirthdays.map((entry) => (
              <BirthdayCard key={entry.id} entry={entry} onOpenPerson={onOpenPerson} />
            ))}
          </div>
        ) : (
          <div
            style={{
              border: "1px dashed #d6d3d1",
              background: "#fafaf9",
              borderRadius: 18,
              padding: 16,
              color: "#78716c",
            }}
          >
            Hoje ninguém faz anos.
          </div>
        )}
      </section>

      <section style={{ marginBottom: 28 }}>
        <h3 style={{ marginTop: 0 }}>Próximos 30 dias</h3>

        {nextThirtyDays.length ? (
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
              gap: 14,
            }}
          >
            {nextThirtyDays.map((entry) => (
              <BirthdayCard key={entry.id} entry={entry} onOpenPerson={onOpenPerson} />
            ))}
          </div>
        ) : (
          <div
            style={{
              border: "1px dashed #d6d3d1",
              background: "#fafaf9",
              borderRadius: 18,
              padding: 16,
              color: "#78716c",
            }}
          >
            Não há aniversários registados nos próximos 30 dias.
          </div>
        )}
      </section>

      <section>
        <h3 style={{ marginTop: 0 }}>Todos os meses</h3>

        <div style={{ display: "grid", gap: 18 }}>
          {Array.from({ length: 12 }, (_, index) => index + 1).map((month) => (
            <div
              key={month}
              style={{
                border: "1px solid #e7e5e4",
                borderRadius: 20,
                padding: 18,
                background: "#fafaf9",
              }}
            >
              <div
                style={{
                  fontSize: 12,
                  textTransform: "uppercase",
                  letterSpacing: "0.16em",
                  color: "#78716c",
                  marginBottom: 10,
                }}
              >
                {sectionTitleForMonth(month)}
              </div>

              {byMonth[month]?.length ? (
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
                    gap: 14,
                  }}
                >
                  {byMonth[month].map((entry) => (
                    <BirthdayCard key={entry.id} entry={entry} onOpenPerson={onOpenPerson} />
                  ))}
                </div>
              ) : (
                <div style={{ color: "#78716c" }}>Sem aniversários registados neste mês.</div>
              )}
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}