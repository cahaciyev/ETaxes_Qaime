const FIELD_LABELS = [
  ["name", "Ad"],
  ["tin", "VÖEN"],
  ["statusName", "Status"],
  ["riskyPayer", "Riskli vergi ödəyicisi"],
  ["vatPayer", "ƏDV qeydiyyatı"],
  ["debt", "Borc (AZN)"],
  ["organizationType", "Təşkilati forma"],
  ["legalAddress", "Hüquqi ünvan"],
  ["legitimate", "Qanuni nümayəndə"],
  ["voenRegisteredAt", "VÖEN qeydiyyat tarixi"],
  ["taxAuthority", "Vergi orqanı"]
];

function formatValue(key, value) {
  if (value == null || value === "") return "—";
  if (key === "riskyPayer") return value ? "Bəli" : "Xeyr";
  if (key === "vatPayer") return value ? "ƏDV qeydiyyatındadır" : "ƏDV qeydiyyatında deyil";
  if (key === "debt") return Number(value).toFixed(2);
  return String(value);
}

export function initVoenPage() {
  const input = document.getElementById("voenInput");
  const btn = document.getElementById("voenCheckBtn");
  const note = document.getElementById("voenNote");
  const result = document.getElementById("voenResult");
  const statusBadge = document.getElementById("voenStatusBadge");
  const placeholder = document.getElementById("voenPlaceholder");
  if (!input || !btn) return;

  function setNote(msg, kind) {
    note.className = "parse-note " + (kind || "info") + " show";
    note.textContent = msg;
  }
  function clearNote() {
    note.className = "parse-note";
    note.textContent = "";
  }

  function renderResult(t) {
    placeholder.style.display = "none";
    result.style.display = "block";
    result.innerHTML = "";
    FIELD_LABELS.forEach(([key, label]) => {
      const row = document.createElement("div");
      row.className = "voen-row";
      const l = document.createElement("span");
      l.className = "voen-row-label";
      l.textContent = label;
      const v = document.createElement("span");
      v.className = "voen-row-value";
      v.textContent = formatValue(key, t[key]);
      row.appendChild(l);
      row.appendChild(v);
      result.appendChild(row);
    });

    statusBadge.style.display = "inline-flex";
    if (t.active && !t.riskyPayer) {
      statusBadge.className = "chip ok";
      statusBadge.textContent = "Aktiv";
    } else if (!t.active) {
      statusBadge.className = "chip bad";
      statusBadge.textContent = "Deaktiv";
    } else {
      statusBadge.className = "chip bad";
      statusBadge.textContent = "Riskli ödəyici";
    }
  }

  async function check() {
    const tin = input.value.trim();
    if (!/^\d{10}$/.test(tin)) {
      setNote("VÖEN 10 rəqəmdən ibarət olmalıdır.", "warn");
      return;
    }
    btn.disabled = true;
    const original = btn.textContent;
    btn.textContent = "Yoxlanılır…";
    clearNote();
    result.style.display = "none";
    statusBadge.style.display = "none";
    placeholder.style.display = "none";
    try {
      const resp = await fetch("/api/voen", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tin })
      });
      const data = await resp.json();
      if (!resp.ok || !data.ok) {
        setNote(data.error || "VÖEN yoxlanılarkən xəta baş verdi.", "warn");
        return;
      }
      renderResult(data.taxpayer);
    } catch (err) {
      setNote("Şəbəkə xətası: " + err.message, "warn");
    } finally {
      btn.disabled = false;
      btn.textContent = original;
    }
  }

  btn.addEventListener("click", check);
  input.addEventListener("keydown", e => { if (e.key === "Enter") check(); });
  input.addEventListener("input", () => {
    input.value = input.value.replace(/[^\d]/g, "").slice(0, 10);
  });
}
