import {
  rowsFromTable, textToTable, normalizeAmount, extractContractNumber,
  validateRow, parseCSV, fetchSheetRows, emptyResultMessage,
  buildInvoiceXml, buildZipPackage
} from "../core/qaimeEngine.js";

export function initQaimePage() {
  let rows = []; // {rrn, name, contract, amount, valid, errors, selected}

  const pasteArea = document.getElementById("pasteArea");
  const parseBtn = document.getElementById("parseBtn");
  const clearBtn = document.getElementById("clearBtn");
  const parseNote = document.getElementById("parseNote");
  const tableCard = document.getElementById("tableCard");
  const rowsBody = document.getElementById("rowsBody");
  const emptyState = document.getElementById("emptyState");
  const actionbar = document.getElementById("actionbar");
  const selCount = document.getElementById("selCount");
  const selSum = document.getElementById("selSum");
  const buildBtn = document.getElementById("buildBtn");
  const senderTin = document.getElementById("senderTin");
  const senderName = document.getElementById("senderName");
  const sheetUrl = document.getElementById("sheetUrl");
  const fetchSheetBtn = document.getElementById("fetchSheetBtn");
  const fetchNote = document.getElementById("fetchNote");
  const fileInput = document.getElementById("fileInput");
  const fileNameEl = document.getElementById("fileName");
  const fileNote = document.getElementById("fileNote");

  if (!pasteArea || !parseBtn) return; // not on this page

  // ---------- settings persistence ----------
  const SETTINGS_KEY = "qaimePaketSettings";
  try {
    const saved = JSON.parse(localStorage.getItem(SETTINGS_KEY) || "{}");
    if (saved.senderTin) senderTin.value = saved.senderTin;
    if (saved.senderName) senderName.value = saved.senderName;
    if (saved.sheetUrl) sheetUrl.value = saved.sheetUrl;
  } catch (e) { /* ignore */ }

  function saveSettings() {
    try {
      localStorage.setItem(SETTINGS_KEY, JSON.stringify({
        senderTin: senderTin.value.trim(),
        senderName: senderName.value.trim(),
        sheetUrl: sheetUrl.value.trim()
      }));
    } catch (e) { /* ignore */ }
  }
  [senderTin, senderName, sheetUrl].forEach(el => el.addEventListener("change", saveSettings));

  // ---------- rendering ----------
  function render() {
    if (!rows.length) {
      tableCard.style.display = "none";
      emptyState.style.display = "block";
      actionbar.style.display = "none";
      return;
    }
    emptyState.style.display = "none";
    tableCard.style.display = "block";
    actionbar.style.display = "flex";

    rowsBody.innerHTML = "";
    rows.forEach((r, i) => {
      const tr = document.createElement("tr");
      tr.className = r.valid ? "" : "row-invalid";

      const tdChk = document.createElement("td");
      tdChk.className = "chk";
      const chk = document.createElement("input");
      chk.type = "checkbox";
      chk.checked = r.selected;
      chk.disabled = !r.valid;
      chk.addEventListener("change", () => { r.selected = chk.checked; updateSummary(); });
      tdChk.appendChild(chk);
      tr.appendChild(tdChk);

      const tdIdx = document.createElement("td");
      tdIdx.className = "idx";
      tdIdx.textContent = i + 1;
      tr.appendChild(tdIdx);

      function editableCell(field, cls) {
        const td = document.createElement("td");
        if (cls) td.className = cls;
        const inp = document.createElement("input");
        inp.type = "text";
        inp.className = cls === "amt" ? "num" : "";
        inp.value = field === "amount" ? (isFinite(r.amount) ? r.amount : "") : r[field];
        inp.addEventListener("input", () => {
          if (field === "amount") r.amount = normalizeAmount(inp.value);
          else r[field] = inp.value;
          r.rrn = field === "rrn" ? inp.value.replace(/[^\d]/g, "") : r.rrn;
          r.errors = validateRow(r);
          const wasValid = r.valid;
          r.valid = r.errors.length === 0;
          if (!r.valid) r.selected = false;
          if (r.valid !== wasValid) render(); else { updateChip(tr, r); updateSummary(); }
        });
        td.appendChild(inp);
        return td;
      }

      tr.appendChild(editableCell("rrn"));
      tr.appendChild(editableCell("name"));
      tr.appendChild(editableCell("contract"));
      tr.appendChild(editableCell("amount", "amt"));

      const tdStatus = document.createElement("td");
      tdStatus.appendChild(makeChip(r));
      tr.appendChild(tdStatus);

      const tdActions = document.createElement("td");
      tdActions.className = "row-actions";
      const xmlBtn = document.createElement("button");
      xmlBtn.className = "xml-toggle";
      xmlBtn.textContent = "XML";
      xmlBtn.addEventListener("click", () => toggleXmlRow(tr, r));
      tdActions.appendChild(xmlBtn);
      const delBtn = document.createElement("button");
      delBtn.className = "xml-toggle row-del";
      delBtn.textContent = "Sil";
      delBtn.title = "Sətri sil";
      delBtn.addEventListener("click", () => deleteRow(r));
      tdActions.appendChild(delBtn);
      tr.appendChild(tdActions);

      rowsBody.appendChild(tr);
    });

    updateSummary();
  }

  function addEmptyRow() {
    const r = { rrn: "", name: "", contract: "", amount: NaN, selected: false };
    r.errors = validateRow(r);
    r.valid = r.errors.length === 0;
    rows.push(r);
    render();
    const inputs = rowsBody.querySelectorAll("tr:last-child input[type=text]");
    if (inputs.length) inputs[0].focus();
  }

  function deleteRow(r) {
    const idx = rows.indexOf(r);
    if (idx === -1) return;
    rows.splice(idx, 1);
    render();
  }

  function makeChip(r) {
    const span = document.createElement("span");
    span.className = "chip " + (r.valid ? "ok" : "bad");
    span.textContent = r.valid ? "Hazır" : r.errors[0];
    span.title = r.errors.join("; ");
    return span;
  }

  function updateChip(tr, r) {
    const cell = tr.children[6];
    cell.innerHTML = "";
    cell.appendChild(makeChip(r));
    tr.className = r.valid ? "" : "row-invalid";
    tr.children[0].querySelector("input").disabled = !r.valid;
    tr.children[0].querySelector("input").checked = r.selected;
  }

  function toggleXmlRow(tr, r) {
    const next = tr.nextElementSibling;
    if (next && next.classList.contains("xml-row")) { next.remove(); return; }
    const xr = document.createElement("tr");
    xr.className = "xml-row";
    const td = document.createElement("td");
    td.colSpan = 8;
    const pre = document.createElement("pre");
    pre.textContent = r.valid
      ? buildInvoiceXml(r, senderTin.value.trim(), senderName.value.trim())
      : "Bu sətirdə xəta var, XML yaradıla bilmir: " + r.errors.join("; ");
    td.appendChild(pre);
    xr.appendChild(td);
    tr.parentNode.insertBefore(xr, tr.nextSibling);
  }

  function updateSummary() {
    const selected = rows.filter(r => r.valid && r.selected);
    selCount.textContent = selected.length;
    selSum.textContent = selected.reduce((a, r) => a + r.amount, 0).toFixed(2);
    buildBtn.disabled = selected.length === 0;
  }

  // ---------- events ----------
  fileInput.addEventListener("change", async () => {
    const file = fileInput.files && fileInput.files[0];
    if (!file) return;
    fileNameEl.textContent = file.name;
    fileNote.className = "parse-note info show";
    fileNote.textContent = "Oxunur…";
    try {
      const ext = file.name.split(".").pop().toLowerCase();
      let table;
      if (ext === "csv") {
        const text = await file.text();
        table = parseCSV(text);
      } else {
        if (typeof XLSX === "undefined") {
          throw new Error("Excel oxuma kitabxanası yüklənmədi (internet bağlantısını yoxlayın) — CSV formatında sınayın.");
        }
        const buf = await file.arrayBuffer();
        const wb = XLSX.read(buf, { type: "array" });
        const sheet = wb.Sheets[wb.SheetNames[0]];
        table = XLSX.utils.sheet_to_json(sheet, { header: 1, raw: false, defval: "" });
      }
      const parsed = rowsFromTable(table);
      rows = parsed;
      if (!parsed.length) {
        fileNote.className = "parse-note warn show";
        fileNote.textContent = emptyResultMessage(table);
      } else {
        const bad = parsed.filter(r => !r.valid).length;
        fileNote.className = "parse-note info show";
        fileNote.textContent = "Fayldan " + parsed.length + " sətir yükləndi" + (bad ? ", " + bad + " sətirdə xəta var" : "") + ".";
      }
      render();
    } catch (err) {
      fileNote.className = "parse-note warn show";
      fileNote.textContent = "Fayl oxunmadı: " + err.message;
    }
  });

  fetchSheetBtn.addEventListener("click", async () => {
    const url = sheetUrl.value.trim();
    if (!url) {
      fetchNote.className = "parse-note warn show";
      fetchNote.textContent = "Əvvəlcə Google Sheets linkini daxil edin.";
      return;
    }
    fetchSheetBtn.disabled = true;
    const original = fetchSheetBtn.textContent;
    fetchSheetBtn.textContent = "Yüklənir…";
    try {
      const table = await fetchSheetRows(url);
      pasteArea.value = table.map(cells => cells.join("\t")).join("\n");
      saveSettings();
      const parsed = rowsFromTable(table);
      rows = parsed;
      if (!parsed.length) {
        fetchNote.className = "parse-note warn show";
        fetchNote.textContent = emptyResultMessage(table);
      } else {
        const bad = parsed.filter(r => !r.valid).length;
        fetchNote.className = "parse-note info show";
        fetchNote.textContent = "Cədvəldən " + parsed.length + " sətir yükləndi" + (bad ? ", " + bad + " sətirdə xəta var" : "") + ".";
      }
      render();
    } catch (err) {
      fetchNote.className = "parse-note warn show";
      fetchNote.textContent = err.message;
    } finally {
      fetchSheetBtn.disabled = false;
      fetchSheetBtn.textContent = original;
    }
  });

  parseBtn.addEventListener("click", () => {
    const table = textToTable(pasteArea.value);
    const parsed = rowsFromTable(table);
    rows = parsed;
    if (!parsed.length) {
      parseNote.className = "parse-note warn show";
      parseNote.textContent = emptyResultMessage(table);
    } else {
      const bad = parsed.filter(r => !r.valid).length;
      parseNote.className = "parse-note info show";
      parseNote.textContent = parsed.length + " sətir tapıldı" + (bad ? ", " + bad + " sətirdə xəta var (cədvəldə düzəldin)" : ", hamısı doğrulandı") + ".";
    }
    render();
  });

  clearBtn.addEventListener("click", () => {
    pasteArea.value = "";
    rows = [];
    parseNote.className = "parse-note";
    render();
  });

  document.getElementById("selectAllBtn").addEventListener("click", () => {
    rows.forEach(r => { if (r.valid) r.selected = true; });
    render();
  });
  document.getElementById("selectNoneBtn").addEventListener("click", () => {
    rows.forEach(r => { r.selected = false; });
    render();
  });

  const addRowBtn = document.getElementById("addRowBtn");
  const addRowBtnTable = document.getElementById("addRowBtnTable");
  if (addRowBtn) addRowBtn.addEventListener("click", addEmptyRow);
  if (addRowBtnTable) addRowBtnTable.addEventListener("click", addEmptyRow);

  buildBtn.addEventListener("click", async () => {
    const selected = rows.filter(r => r.valid && r.selected);
    if (!selected.length) return;
    buildBtn.disabled = true;
    const originalLabel = buildBtn.textContent;
    buildBtn.textContent = "Hazırlanır…";
    try {
      const sTin = senderTin.value.trim();
      const sName = senderName.value.trim();
      const entries = selected.map((r, i) => ({
        name: "qaime_" + (i + 1) + "_" + r.rrn + ".xml",
        content: new TextEncoder().encode(buildInvoiceXml(r, sTin, sName))
      }));
      const zipBytes = await buildZipPackage(entries);
      const blob = new Blob([zipBytes], { type: "application/zip" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      const stamp = new Date().toISOString().slice(0, 10).replace(/-/g, "");
      a.href = url;
      a.download = "paket_" + stamp + ".zip";
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 4000);
    } catch (err) {
      parseNote.className = "parse-note warn show";
      parseNote.textContent = "ZIP hazırlanarkən xəta baş verdi: " + err.message;
    } finally {
      buildBtn.disabled = selected.length === 0;
      buildBtn.textContent = originalLabel;
    }
  });

  render();
}
