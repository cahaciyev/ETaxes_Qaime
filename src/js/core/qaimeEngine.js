// QAIME_1 (v304) parsing / validation / XML / ZIP engine.
// Logic ported unchanged from the original single-file implementation.

export function splitCells(line) {
  if (line.indexOf("\t") !== -1) return line.split("\t");
  return line.split(",");
}

export function detectColumnMap(headerCells) {
  const map = {};
  let hits = 0;
  headerCells.forEach((h, i) => {
    const key = String(h == null ? "" : h).trim().toLowerCase();
    if (!key) return;
    if (map.rrn === undefined && /(borrower.?id|\bid\b|rrn|voen|v[öo]en)/.test(key)) { map.rrn = i; hits++; }
    else if (map.contract === undefined && /(m[üu]qavil|contract)/.test(key)) { map.contract = i; hits++; }
    else if (map.name === undefined && /(^ad[ıi]?$|\bname\b|adı)/.test(key)) { map.name = i; hits++; }
    else if (map.amount === undefined && /(amount|m[əe]bl[əe]ğ|sum)/.test(key)) { map.amount = i; hits++; }
  });
  return hits >= 2 ? map : null;
}

export function rowsFromTable(table) {
  if (!table || !table.length) return [];
  let startIdx = 0;
  let colMap = { rrn: 0, name: 1, contract: 2, amount: 3 };
  const detected = detectColumnMap(table[0]);
  if (detected) {
    colMap = Object.assign({}, colMap, detected);
    startIdx = 1;
  }
  const out = [];
  for (let i = startIdx; i < table.length; i++) {
    const cells = table[i];
    if (!cells || !cells.some(c => String(c == null ? "" : c).trim().length)) continue;
    const rrn = String(cells[colMap.rrn] == null ? "" : cells[colMap.rrn]).replace(/[^\d]/g, "");
    const name = String(cells[colMap.name] == null ? "" : cells[colMap.name]).trim();
    const contract = String(cells[colMap.contract] == null ? "" : cells[colMap.contract]).trim();
    const amount = normalizeAmount(cells[colMap.amount]);
    const r = { rrn, name, contract, amount, selected: true };
    r.errors = validateRow(r);
    r.valid = r.errors.length === 0;
    out.push(r);
  }
  return out;
}

export function emptyResultMessage(table) {
  if (!table || !table.length) return "Cədvəl boşdur, heç bir sətir tapılmadı.";
  if (!detectColumnMap(table[0])) {
    return "Sütun başlıqları tanınmadı (gözlənilən: Ad, Müqavilə, RRN/VÖEN/Borrower ID, Amount/Məbləğ). Birinci sətirdə bu adlardan ən azı ikisi olmalıdır.";
  }
  if (table.length === 1) {
    return "Yalnız başlıq sətri tapıldı, data sətri yoxdur. Başlıq sətri ilə data sətirləri arasında ayrıca sətir olduğundan əmin olun — çox güman ki, hamısı bir sətirdə birləşib (məs. Enter əvəzinə Tab basılıb).";
  }
  return "Sətir tapılmadı.";
}

export function textToTable(text) {
  return text.split(/\r?\n/).map(l => l.trim()).filter(l => l.length > 0).map(splitCells);
}

export function normalizeAmount(raw) {
  if (raw == null) return NaN;
  let s = String(raw).trim().replace(/\s/g, "").replace(/,/g, ".");
  const parts = s.split(".");
  if (parts.length > 2) {
    s = parts.slice(0, -1).join("") + "." + parts[parts.length - 1];
  }
  return parseFloat(s);
}

export function extractContractNumber(raw) {
  return String(raw == null ? "" : raw).replace(/\D/g, "");
}

export function validateRow(r) {
  const errors = [];
  if (!/^\d{10}$/.test(r.rrn)) errors.push("RRN 10 rəqəm olmalıdır");
  if (!extractContractNumber(r.contract)) errors.push("Müqavilə nömrəsində rəqəm tapılmadı");
  if (!isFinite(r.amount) || r.amount <= 0) errors.push("Məbləğ yanlışdır");
  return errors;
}

export function parseCSV(text) {
  const rows = [];
  let row = [], field = "", inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; }
        else inQuotes = false;
      } else field += c;
    } else {
      if (c === '"') inQuotes = true;
      else if (c === ",") { row.push(field); field = ""; }
      else if (c === "\n") { row.push(field); rows.push(row); row = []; field = ""; }
      else if (c === "\r") { /* skip */ }
      else field += c;
    }
  }
  if (field.length || row.length) { row.push(field); rows.push(row); }
  return rows.filter(r => r.some(c => c.trim().length));
}

export function extractSheetId(url) {
  const m = url.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
  return m ? m[1] : null;
}
export function extractGid(url) {
  const m = url.match(/[?&#]gid=([0-9]+)/);
  return m ? m[1] : "0";
}

export async function fetchSheetRows(url) {
  const id = extractSheetId(url.trim());
  if (!id) throw new Error("Google Sheets linki tanınmadı. Ünvan '/spreadsheets/d/' hissəsini ehtiva etməlidir.");
  const gid = extractGid(url.trim());
  const csvUrl = "https://docs.google.com/spreadsheets/d/" + id + "/export?format=csv&gid=" + gid;
  let resp;
  try {
    resp = await fetch(csvUrl);
  } catch (e) {
    throw new Error("Cədvələ şəbəkə sorğusu bloklandı. Bu funksiya yalnız saytın öz ünvanından açıldıqda işləyir — aşağıdakı yapışdırma üsulunu istifadə edin.");
  }
  if (!resp.ok) {
    throw new Error("Cədvəl yüklənmədi (HTTP " + resp.status + "). Paylaşım icazəsini yoxlayın: \"Link olan hər kəs baxa bilər\".");
  }
  const csvText = await resp.text();
  return parseCSV(csvText);
}

export function parsePasted(text) {
  return rowsFromTable(textToTable(text));
}

// ---------- XML / ZIP building (QAIME_1 v304, VHF package format) ----------
const STYLESHEET_BLOCK = '<xsl:stylesheet id="stylesheet" version="1.0" xmlns:xsl="http://www.w3.org/1999/XSL/Transform" > <xsl:template match="xsl:stylesheet" /> <xsl:template match="/root"> <html> <head> <style> body {background-color: white; font-family:  Arial, sans-serif; } .paper {padding:5px; } table {width: 100%; font-size: 16px; } table tr td {padding: 10px 15px; text-align: left; width:50%; } .products table {border-collapse: collapse; font-size: 14px; } .products table th, #products table td  {border: 1px solid #000; padding: 10px; } .products table td {width:auto; border: 1px solid #000; text-align:center; } .products table th {text-align:center; } .noPadding {padding: 40px 0px; } .total tr :nth-child(odd) {width:40%; } .total tr :nth-child(even) {width:10%; } </style> </head> <body> <table class="paper"> <tr> <td>Alan tərəfin VÖEN-i:</td> <td><xsl:value-of select="qaimeKime"/></td> </tr> <tr> <td>Alan tərəfin adı:</td> <td><xsl:value-of select="qaimeKimeAd"/></td> </tr> <tr> <td>Satan tərəfin VÖEN-i:</td> <td><xsl:value-of select="qaimeKimden"/></td> </tr> <tr> <td>Qeyd</td> <td><xsl:value-of select="des"/></td> </tr> <tr> <td>Əlavə qeyd</td> <td><xsl:value-of select="des2"/></td> </tr> <tr> <td>Obyektin adı</td> <td><xsl:value-of select="ma"/></td> </tr> <tr> <td>Obyektin kodu</td> <td><xsl:value-of select="mk"/></td> </tr> <tr> <td class="products noPadding" colspan="2"> <table> <thead> <th>Mal kodu</th> <th>Mal adı</th> <th>Bar kod</th> <th>Ölçü vahidi</th> <th>Malın miqdarı</th> <th>Malın buraxılış qiyməti</th> <th>Cəmi qiyməti</th> <th>Aksiz dərəcəsi</th> <th>Aksiz məbləği</th> <th>Cəmi məbləğ</th> <th>ƏDV-yə cəlb edilən məbləği</th> <th>ƏDV-yə cəlb edilməyən məbləği</th> <th>ƏDV-dən azad olunan</th> <th>ƏDV-yə 0 dərəcə ilə cəlb edilən məbləği</th> <th>Ödənilməli ƏDV</th> <th>Yol vergisi məbləği</th> <th>Yekun məbləğ</th> </thead> <tbody class="productTable"> <xsl:for-each select="product/qaimeTable/row"> <tr> <td><xsl:value-of select="c1"/></td> <td><xsl:value-of select="c2"/></td> <td><xsl:value-of select="c17"/></td> <td><xsl:value-of select="c3"/></td> <td><xsl:value-of select="c4"/></td> <td><xsl:value-of select="c5"/></td> <td><xsl:value-of select="c6"/></td> <td><xsl:value-of select="c7"/></td> <td><xsl:value-of select="c8"/></td> <td><xsl:value-of select="c9"/></td> <td><xsl:value-of select="c10"/></td> <td><xsl:value-of select="c11"/></td> <td><xsl:value-of select="c12"/></td> <td><xsl:value-of select="c13"/></td> <td><xsl:value-of select="c14"/></td> <td><xsl:value-of select="c15"/></td> <td><xsl:value-of select="c16"/></td> </tr> </xsl:for-each> </tbody> </table> </td> </tr> </table> <table class="total"> <tr> <td>Malların cəmi qiyməti</td> <td><xsl:value-of select="product/qaimeYekunTable/row/c1"/></td> <td>Malların cəmi məbləği</td> <td><xsl:value-of select="product/qaimeYekunTable/row/c3"/></td> </tr> <tr> <td>Malların aksiz cəmi məbləği</td> <td><xsl:value-of select="product/qaimeYekunTable/row/c2"/></td> <td>Malların ƏDV-yə cəlb edilən cəmi məbləği</td> <td><xsl:value-of select="product/qaimeYekunTable/row/c4"/></td> </tr> <tr> <td>Malların cəmi ödənilməli ƏDV məbləği</td> <td><xsl:value-of select="product/qaimeYekunTable/row/c8"/></td> <td>Malların  ƏDV-yə cəlb edilməyən cəmi məbləği </td> <td><xsl:value-of select="product/qaimeYekunTable/row/c5"/></td> </tr> <tr> <td>ƏDV-dən azad olunan</td> <td><xsl:value-of select="product/qaimeYekunTable/row/c6"/></td> <td>Malların  ƏDV-yə 0 dərəcə ilə cəlb edilən cəmi məbləği</td> <td><xsl:value-of select="product/qaimeYekunTable/row/c7"/></td> </tr> <tr> <td>Yekun məbləğ</td> <td><xsl:value-of select="product/qaimeYekunTable/row/c9"/></td> <td></td> <td></td> </tr> </table> </body> </html> </xsl:template> </xsl:stylesheet>';

export function escapeXml(s) {
  return String(s == null ? "" : s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

export function buildInvoiceXml(row, sTin, sName) {
  const contractNum = extractContractNumber(row.contract);
  const desText = contractNum + " saylı lizinq müqaviləsinə əsasən aylıq mükafat";
  const des2Text = contractNum + " saylı lizinq müqaviləsinə əsasən";
  const amt2 = row.amount.toFixed(2);
  const amt4 = row.amount.toFixed(4);

  return '<?xml version="1.0" encoding="UTF-8"?>\n' +
    '<?xml-stylesheet type="text/xsl" href="#stylesheet"?>\n' +
    '<!DOCTYPE root [\n<!ATTLIST xsl:stylesheet\nid ID #REQUIRED>\n]>\n' +
    '<root version ="304" kod= "QAIME_1"  xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:noNamespaceSchemaLocation= "QAIME_1.xsd" >\n' +
    STYLESHEET_BLOCK + '\t<qaimeKime>' + escapeXml(row.rrn) + '</qaimeKime>\n' +
    '\t<qaimeKimden>' + escapeXml(sTin) + '</qaimeKimden>\n' +
    '\t<ds></ds>\n' +
    '\t<dn></dn>\n' +
    '\t<des>' + escapeXml(desText) + '</des>\n' +
    '\t<des2>' + escapeXml(des2Text) + '</des2>\n' +
    '\t<ma></ma>\n' +
    '\t<mk></mk>\n' +
    '\t<product>\n' +
    '\t\t<qaimeTable>\n' +
    "\t\t\t<row no = '0'>\n" +
    '\t\t\t\t<c1>9964911000</c1>\n' +
    '\t\t\t\t<c2>' + escapeXml(desText) + '</c2>\n' +
    '\t\t\t\t<c3>mükafat</c3>\n' +
    '\t\t\t\t<c4>1</c4>\n' +
    '\t\t\t\t<c5>' + amt2 + '</c5>\n' +
    '\t\t\t\t<c6>' + amt4 + '</c6>\n' +
    '\t\t\t\t<c7>0</c7>\n' +
    '\t\t\t\t<c8>0</c8>\n' +
    '\t\t\t\t<c9>' + amt4 + '</c9>\n' +
    '\t\t\t\t<c10>0</c10>\n' +
    '\t\t\t\t<c11>' + amt2 + '</c11>\n' +
    '\t\t\t\t<c12>0</c12>\n' +
    '\t\t\t\t<c13>0</c13>\n' +
    '\t\t\t\t<c14>0.0000</c14>\n' +
    '\t\t\t\t<c15>0</c15>\n' +
    '\t\t\t\t<c16>' + amt4 + '</c16>\n' +
    '\t\t\t\t<c17>0</c17>\n' +
    '\t\t\t\t<productId>0</productId>\n' +
    '\t\t\t</row>\n' +
    '\t\t</qaimeTable>\n' +
    '\t\t<qaimeYekunTable>\n' +
    '\t\t\t<row>\n' +
    '\t\t\t\t<c1>' + amt2 + '</c1>\n' +
    '\t\t\t\t<c2>0</c2>\n' +
    '\t\t\t\t<c3>' + amt2 + '</c3>\n' +
    '\t\t\t\t<c4>0</c4>\n' +
    '\t\t\t\t<c5>' + amt2 + '</c5>\n' +
    '\t\t\t\t<c6>0</c6>\n' +
    '\t\t\t\t<c7>0</c7>\n' +
    '\t\t\t\t<c8>0.00</c8>\n' +
    '\t\t\t\t<c9>' + amt2 + '</c9>\n' +
    '\t\t\t\t<c10>0</c10>\n' +
    '\t\t\t</row>\n' +
    '\t\t</qaimeYekunTable>\n' +
    '\t</product>\n' +
    '</root>\n';
}

// -- byte writer --
function ByteWriter() { this.parts = []; }
ByteWriter.prototype.u16 = function (v) { this.parts.push(new Uint8Array([v & 0xFF, (v >> 8) & 0xFF])); };
ByteWriter.prototype.u32 = function (v) {
  this.parts.push(new Uint8Array([v & 0xFF, (v >> 8) & 0xFF, (v >> 16) & 0xFF, (v >>> 24) & 0xFF]));
};
ByteWriter.prototype.bytes = function (b) { this.parts.push(b); };
ByteWriter.prototype.toBytes = function () { return concatBytes(this.parts); };

function concatBytes(arr) {
  let total = 0;
  for (const a of arr) total += a.length;
  const out = new Uint8Array(total);
  let off = 0;
  for (const a of arr) { out.set(a, off); off += a.length; }
  return out;
}

const CRC_TABLE = (function () {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
    t[n] = c >>> 0;
  }
  return t;
})();

function crc32(bytes) {
  let crc = 0xFFFFFFFF;
  for (let i = 0; i < bytes.length; i++) crc = CRC_TABLE[(crc ^ bytes[i]) & 0xFF] ^ (crc >>> 8);
  return (crc ^ 0xFFFFFFFF) >>> 0;
}

async function rawDeflate(bytes) {
  const cs = new CompressionStream("deflate-raw");
  const writer = cs.writable.getWriter();
  writer.write(bytes);
  writer.close();
  const reader = cs.readable.getReader();
  const chunks = [];
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
  }
  return concatBytes(chunks);
}

function dosDateTime(d) {
  const dosTime = ((d.getHours() & 0x1F) << 11) | ((d.getMinutes() & 0x3F) << 5) | ((Math.floor(d.getSeconds() / 2)) & 0x1F);
  const dosDate = (((Math.max(0, d.getFullYear() - 1980)) & 0x7F) << 9) | (((d.getMonth() + 1) & 0xF) << 5) | (d.getDate() & 0x1F);
  return { dosTime, dosDate };
}

async function buildZipEntry(name, contentBytes, dosTime, dosDate, relOffset) {
  const nameBytes = new TextEncoder().encode(name);
  const compressed = await rawDeflate(contentBytes);
  const crc = crc32(contentBytes);
  const csize = compressed.length;
  const usize = contentBytes.length;

  const local = new ByteWriter();
  local.u32(0x04034B50);
  local.u16(20); local.u16(8); local.u16(8);
  local.u16(dosTime); local.u16(dosDate);
  local.u32(0); local.u32(0); local.u32(0);
  local.u16(nameBytes.length); local.u16(0);
  local.bytes(nameBytes);

  const descriptor = new ByteWriter();
  descriptor.u32(0x08074B50);
  descriptor.u32(crc); descriptor.u32(csize); descriptor.u32(usize);

  const block = concatBytes([local.toBytes(), compressed, descriptor.toBytes()]);

  const cd = new ByteWriter();
  cd.u32(0x02014B50);
  cd.u16(20); cd.u16(20); cd.u16(8); cd.u16(8);
  cd.u16(dosTime); cd.u16(dosDate);
  cd.u32(crc); cd.u32(csize); cd.u32(usize);
  cd.u16(nameBytes.length); cd.u16(0); cd.u16(0); cd.u16(0); cd.u16(0);
  cd.u32(0); cd.u32(relOffset);
  cd.bytes(nameBytes);

  return { block, cdEntry: cd.toBytes() };
}

export async function buildZipPackage(entries) {
  const now = new Date();
  const { dosTime, dosDate } = dosDateTime(now);
  const mfContent = new TextEncoder().encode("VHF-Manifest-Version: 1.0\r\n\r\n");
  const all = [{ name: "vhf-inf/vhf.mf", content: mfContent }].concat(entries);

  let offset = 0;
  const blocks = [], cdEntries = [];
  for (const e of all) {
    const { block, cdEntry } = await buildZipEntry(e.name, e.content, dosTime, dosDate, offset);
    blocks.push(block); cdEntries.push(cdEntry);
    offset += block.length;
  }
  const cdOffset = offset;
  let cdSize = 0;
  for (const c of cdEntries) cdSize += c.length;

  const eocd = new ByteWriter();
  eocd.u32(0x06054B50);
  eocd.u16(0); eocd.u16(0);
  eocd.u16(all.length); eocd.u16(all.length);
  eocd.u32(cdSize); eocd.u32(cdOffset); eocd.u16(0);

  return concatBytes(blocks.concat(cdEntries).concat([eocd.toBytes()]));
}
