type PersonCardProps = {
  fullName: string;
  birthDate: string;
  deathDate: string;
  birthPlace: string;
  photo?: string;
  onClick: () => void;
  onDetails?: () => void;
  highlight?: boolean;
  label?: string;
  compact?: boolean;
  minimal?: boolean;
};

export default function PersonCard({
  fullName,
  birthDate,
  deathDate,
  birthPlace,
  photo,
  onClick,
  onDetails,
  highlight = false,
  label,
  compact = false,
  minimal = false,
}: PersonCardProps) {
  // 🔹 versão minimal (ascendentes)
  if (minimal) {
    return (
      <div
        onClick={onClick}
        style={{
          background: highlight ? "#fef3c7" : "white",
          border: "1px solid #e7e5e4",
          borderRadius: 20,
          padding: 10,
          cursor: "pointer",
          display: "flex",
          alignItems: "center",
          gap: 10,
        }}
      >
        {photo ? (
          <img
            src={photo}
            alt={fullName}
            style={{
              width: 50,
              height: 50,
              objectFit: "contain",
              borderRadius: 12,
              background: "#fafaf9",
            }}
          />
        ) : null}

        <div
          style={{
            fontSize: 13,
            fontWeight: 600,
            color: "#292524",
          }}
        >
          {fullName}
        </div>
      </div>
    );
  }

  // 🔹 versão normal
  return (
    <div
      onClick={onClick}
      style={{
        background: highlight ? "#fef3c7" : "white",
        border: "1px solid #e7e5e4",
        borderRadius: 20,
        padding: compact ? 12 : 14,
        cursor: "pointer",
      }}
    >
      <div
        style={{
          display: "flex",
          gap: 14,
          alignItems: "flex-start",
        }}
      >
        {photo ? (
          <img
            src={photo}
            alt={fullName}
            style={{
              width: compact ? 70 : 90,
              height: compact ? 70 : 90,
              objectFit: "contain",
              borderRadius: 14,
              background: "#fafaf9",
              flexShrink: 0,
            }}
          />
        ) : null}

        <div style={{ flex: 1 }}>
          {label ? (
            <div
              style={{
                fontSize: 11,
                textTransform: "uppercase",
                letterSpacing: "0.18em",
                color: "#78716c",
                marginBottom: 6,
              }}
            >
              {label}
            </div>
          ) : null}

          <strong style={{ fontSize: compact ? 14 : 16 }}>{fullName}</strong>

          <div
            style={{
              marginTop: 6,
              color: "#57534e",
              fontSize: compact ? 13 : 14,
            }}
          >
            {birthDate} — {deathDate}
          </div>

          <div style={{ color: "#57534e", fontSize: compact ? 13 : 14 }}>
            {birthPlace}
          </div>

          {!compact && onDetails ? (
            <div style={{ marginTop: 10 }}>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onDetails();
                }}
                style={{
                  border: "1px solid #d6d3d1",
                  background: "white",
                  borderRadius: 10,
                  padding: "6px 10px",
                  cursor: "pointer",
                  fontSize: 13,
                }}
              >
                + Detalhes
              </button>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}